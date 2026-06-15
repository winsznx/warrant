import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { verifyReceipt } from "./verifiers/receipt.js";
import { verifyDelivery } from "./verifiers/delivery.js";
import { verifyMilestone } from "./verifiers/milestone.js";
import { verifyManual } from "./verifiers/manual.js";
import { PaymentGate } from "./x402/client.js";
import { fetchProof } from "./proof.js";
import { createLogger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load agent/.env first (highest priority), then repo-root .env as fallback.
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const log = createLogger("agent");

const ANVIL_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const providerUrl = process.env.CELO_RPC_URL || "http://127.0.0.1:8545";
const privateKey = process.env.AGENT_PRIVATE_KEY || ANVIL_KEY;
const contractAddress = process.env.WARRANT_CONTRACT_ADDRESS;
const startBlockEnv = process.env.AGENT_START_BLOCK;

const WARRANT_AGENT_ABI = JSON.parse(
  readFileSync(new URL("./abi/WarrantAgent.json", import.meta.url), "utf8"),
) as ethers.InterfaceAbi;

const ConditionTypeName = ["RECEIPT", "DELIVERY", "MILESTONE", "MANUAL"] as const;
const WarrantStatus = { OPEN: 0, CLAIMED: 1, RELEASED: 2, REFUNDED: 3 } as const;

// Idempotency guards so a re-fired event never double-processes a warrant.
const inFlight = new Set<string>();
const settled = new Set<string>();

/** Retry a transient operation with linear backoff (RPC/TLS hiccups). */
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      log.warn(`${label}: attempt ${attempt}/${attempts} failed (${msg.slice(0, 140)})`);
      if (attempt < attempts) await new Promise((r) => setTimeout(r, 2_000 * attempt));
    }
  }
  throw lastErr;
}

function validateEnv(): void {
  if (!process.env.AGENT_PRIVATE_KEY) {
    log.warn("AGENT_PRIVATE_KEY not set — using the default anvil key (local only).");
  }
  if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY && !process.env.LLM_API_KEY) {
    log.warn("No LLM key (GROQ_API_KEY / OPENAI_API_KEY) set — receipt/delivery/manual verifiers run in heuristic mode.");
  }
  if (!process.env.GITHUB_TOKEN) {
    log.warn("GITHUB_TOKEN not set — milestone verifier runs in heuristic mode.");
  }
}

async function dispatchVerifier(
  conditionType: number,
  proof: Awaited<ReturnType<typeof fetchProof>>,
  ruleURI: string,
): Promise<boolean> {
  switch (conditionType) {
    case 0:
      return verifyReceipt(proof, ruleURI);
    case 1:
      return verifyDelivery(proof, ruleURI);
    case 2:
      return verifyMilestone(proof, ruleURI);
    case 3:
      return verifyManual(proof, ruleURI);
    default:
      log.error(`Unknown condition type: ${conditionType}`);
      return false;
  }
}

async function handleVerification(
  warrantId: string,
  conditionType: number,
  ruleURI: string,
  proofURI: string,
  contract: ethers.Contract | null,
  gate: PaymentGate | null,
): Promise<void> {
  if (inFlight.has(warrantId) || settled.has(warrantId)) {
    log.info(`Warrant ${warrantId}: already processing/settled — skipping.`);
    return;
  }
  inFlight.add(warrantId);

  try {
    if (contract) {
      const warrant = await contract.getWarrant(warrantId);
      if (Number(warrant.status) !== WarrantStatus.CLAIMED) {
        log.info(`Warrant ${warrantId}: status is not CLAIMED — skipping.`);
        settled.add(warrantId);
        return;
      }
    }

    if (gate) await gate.authorize(warrantId);

    const proof = await fetchProof(proofURI);
    const typeName = ConditionTypeName[conditionType] ?? `#${conditionType}`;
    log.info(`Warrant ${warrantId}: verifying (${typeName}). Proof:`, proof);

    const verified = await dispatchVerifier(conditionType, proof, ruleURI);
    log.info(`Warrant ${warrantId}: verification ${verified ? "APPROVED" : "REJECTED"}.`);

    if (!contract) {
      log.info(`[dry-run] Warrant ${warrantId}: skipping on-chain write.`);
      return;
    }

    const action = verified ? "release" : "reject";
    await withRetry(`Warrant ${warrantId} ${action}`, async () => {
      // Re-check status before each attempt so a retry never double-sends if a
      // prior attempt actually landed but its receipt fetch failed.
      const current = await contract.getWarrant(warrantId);
      if (Number(current.status) !== WarrantStatus.CLAIMED) {
        log.info(`Warrant ${warrantId}: status ${Number(current.status)} — already settled, skipping.`);
        return;
      }
      const tx = verified
        ? await contract.agentRelease(warrantId)
        : await contract.agentReject(warrantId, "Proof did not satisfy the condition.");
      log.info(`Warrant ${warrantId}: ${action} sent (${tx.hash}).`);
      const receipt = await tx.wait();
      log.info(`Warrant ${warrantId}: ${action}d. Gas used ${receipt.gasUsed.toString()}.`);
    });
    settled.add(warrantId);
  } catch (err) {
    log.error(`Warrant ${warrantId}: verification handler failed`, err);
  } finally {
    inFlight.delete(warrantId);
  }
}

async function runDryRunMode(): Promise<void> {
  log.warn("WARRANT_CONTRACT_ADDRESS not set — running in dry-run mode.");
  log.info("Pipe simulated proofs as: <warrantId>|<conditionType>|<ruleURI>|<proofURI>");

  process.stdin.on("data", async (data) => {
    const parts = data.toString().trim().split("|");
    if (parts.length < 4) {
      log.warn("Invalid format. Use: <warrantId>|<conditionType>|<ruleURI>|<proofURI>");
      return;
    }
    const [id, ct, rule, proof] = parts;
    await handleVerification(id, Number.parseInt(ct, 10), rule, proof, null, null);
  });
}

async function main(): Promise<void> {
  log.info("Warrant autonomous agent starting.");
  log.info(`RPC: ${providerUrl}`);
  validateEnv();

  const provider = new ethers.JsonRpcProvider(providerUrl);

  let wallet: ethers.Wallet;
  try {
    wallet = new ethers.Wallet(privateKey, provider);
  } catch (err) {
    log.error("Invalid AGENT_PRIVATE_KEY", err);
    process.exit(1);
  }
  log.info(`Operator address: ${wallet.address}`);

  if (!contractAddress) {
    await runDryRunMode();
    return;
  }

  log.info(`Warrant contract: ${contractAddress}`);
  const contract = new ethers.Contract(contractAddress, WARRANT_AGENT_ABI, wallet);
  const gate = new PaymentGate(contract);

  // Event ingestion via block-range polling (eth_getLogs). Stateful
  // eth_newFilter subscriptions used by contract.on() fail with "filter not
  // found" on load-balanced public RPCs like forno, so we poll getLogs ranges
  // instead — which also subsumes backfill from AGENT_START_BLOCK.
  const pollIntervalMs = Number(process.env.AGENT_POLL_INTERVAL_MS || 6_000);
  const maxRange = Number(process.env.AGENT_MAX_BLOCK_RANGE || 5_000);
  const proofFilter = contract.filters.ProofSubmitted();

  let lastBlock = startBlockEnv
    ? Number.parseInt(startBlockEnv, 10) - 1
    : await provider.getBlockNumber();
  log.info(`Polling ProofSubmitted from block ${lastBlock + 1} every ${pollIntervalMs}ms.`);

  let polling = false;
  async function poll(): Promise<void> {
    if (polling) return;
    polling = true;
    try {
      const latest = await provider.getBlockNumber();
      while (lastBlock < latest) {
        const from = lastBlock + 1;
        const to = Math.min(latest, from + maxRange - 1);
        const events = await contract.queryFilter(proofFilter, from, to);
        for (const ev of events) {
          if (!("args" in ev) || !ev.args) continue;
          const warrantId = ev.args.warrantId.toString();
          const proofURI: string = ev.args.proofURI;
          log.info(`Event ProofSubmitted: warrant ${warrantId} (block ${ev.blockNumber}).`);
          try {
            const warrant = await contract.getWarrant(warrantId);
            await handleVerification(
              warrantId,
              Number(warrant.conditionType),
              warrant.ruleURI,
              proofURI,
              contract,
              gate,
            );
          } catch (err) {
            log.error(`Warrant ${warrantId}: failed to handle event`, err);
          }
        }
        lastBlock = to;
      }
    } catch (err) {
      log.error("Poll cycle failed", err);
    } finally {
      polling = false;
    }
  }

  await poll();
  const pollTimer = setInterval(() => void poll(), pollIntervalMs);
  log.info("Listening for ProofSubmitted events…");

  const heartbeat = setInterval(() => {
    log.info(`Heartbeat — head block ${lastBlock}, ${settled.size} settled, ${inFlight.size} in flight.`);
  }, 60_000);

  const shutdown = (signal: string) => {
    log.info(`Received ${signal} — shutting down.`);
    clearInterval(pollTimer);
    clearInterval(heartbeat);
    provider.destroy();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  log.error("Fatal error", err);
  process.exit(1);
});
