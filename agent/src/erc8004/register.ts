import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "../logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const log = createLogger("register");

// ERC-8004 IdentityRegistry ("AgentIdentity") deployments.
const REGISTRY_BY_CHAIN: Record<number, string> = {
  42220: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432", // Celo mainnet
};

const providerUrl = process.env.CELO_RPC_URL || "https://forno.celo.org";
const privateKey = process.env.AGENT_PRIVATE_KEY;
const warrantContract = process.env.WARRANT_CONTRACT_ADDRESS ?? "";
const endpoint = process.env.AGENT_ENDPOINT || "https://trywarrant.xyz";
const imageUrl = process.env.AGENT_IMAGE_URL || "https://trywarrant.xyz/logo.png";

const IDENTITY_REGISTRY_ABI = [
  "function register() external returns (uint256)",
  "function setAgentURI(uint256 agentId, string newURI) external",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function balanceOf(address owner) external view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

async function main(): Promise<void> {
  if (!privateKey) {
    log.error("AGENT_PRIVATE_KEY is required to register.");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(providerUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const chainId = Number((await provider.getNetwork()).chainId);

  const registryAddress =
    process.env.REGISTRY_CONTRACT_ADDRESS || REGISTRY_BY_CHAIN[chainId];
  if (!registryAddress) {
    log.error(`No ERC-8004 registry known for chain ${chainId}. Set REGISTRY_CONTRACT_ADDRESS.`);
    process.exit(1);
  }

  log.info(`Operator: ${wallet.address}`);
  log.info(`Registry: ${registryAddress} (chain ${chainId})`);

  const registry = new ethers.Contract(registryAddress, IDENTITY_REGISTRY_ABI, wallet);

  // 1. Resolve the agentId. When AGENT_ID is set, update that existing identity's
  //    card (setAgentURI) instead of minting a new one — re-running register()
  //    would mint a fresh agentId every time.
  let agentId: bigint | null = null;
  const existingId = process.env.AGENT_ID?.trim();
  if (existingId) {
    agentId = BigInt(existingId);
    const owner = await registry.ownerOf(agentId);
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
      log.error(`agentId ${agentId} is owned by ${owner}, not ${wallet.address}. Cannot update its card.`);
      process.exit(1);
    }
    log.info(`Updating existing agentId ${agentId} (owner ${owner}).`);
  } else {
    log.info("Registering agent identity…");
    const tx = await registry.getFunction("register()")();
    const receipt = await tx.wait();
    for (const entry of receipt.logs) {
      try {
        const parsed = registry.interface.parseLog(entry);
        if (parsed?.name === "Transfer" && parsed.args.from === ethers.ZeroAddress) {
          agentId = parsed.args.tokenId as bigint;
          break;
        }
      } catch {
        // not a Transfer log we can decode
      }
    }
    if (agentId === null) {
      log.error("Could not determine agentId from the mint logs.");
      process.exit(1);
    }
    log.info(`Minted agentId ${agentId} (tx ${receipt.hash}).`);
  }

  // 2. Build the ERC-8004 registration file (agent card) and attach it inline
  //    as a base64 data URI (immutable, self-contained — no external hosting).
  //    Shaped per the 8004scan best-practices data profile so the explorer
  //    parses every field directly (no LLM back-fill) and scores it richly:
  //    CAIP-10 ids, typed services (web + agentWallet + OASF skills/domains),
  //    declared trust models, production + x402 flags, and a freshness stamp.
  const card = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "Warrant",
    description:
      "Autonomous conditional-payment escrow agent on Celo. Locks cUSD and releases it onchain when a real-world condition is verified by AI — receipts and deliveries via vision, GitHub milestones, or manual rules. Charges per verification over x402, can settle to local stablecoins via Mento, and runs as a MiniPay Mini App.",
    image: imageUrl,
    active: true,
    x402Support: true,
    supportedTrust: ["reputation", "crypto-economic"],
    services: [
      { name: "web", endpoint, version: "1.0.0" },
      // A2A discovery + JSON-RPC surface; the card lives at
      // <endpoint>/.well-known/agent-card.json (served by the app).
      { name: "A2A", endpoint, version: "0.3.0" },
      // The agent's onchain wallet — where x402 cUSD micro-fees land (CAIP-10).
      { name: "agentWallet", endpoint: `eip155:${chainId}:${wallet.address}` },
      // OASF capability taxonomy — declares skills/domains explicitly so the
      // explorer doesn't have to infer tags from the description.
      {
        name: "OASF",
        endpoint: "https://github.com/agntcy/oasf/",
        version: "v0.8.0",
        skills: [
          "evaluation_monitoring/anomaly_detection",
          "natural_language_processing/information_extraction",
          "image_processing/image_analysis",
          "advanced_reasoning_planning/decision_making",
        ],
        domains: [
          "finance_and_business/payments",
          "technology/blockchain/smart_contracts",
          "technology/blockchain/defi",
        ],
      },
    ],
    registrations: [
      { agentId: Number(agentId), agentRegistry: `eip155:${chainId}:${registryAddress}` },
    ],
    warrantContract: `eip155:${chainId}:${warrantContract}`,
    updatedAt: Math.floor(Date.now() / 1000),
  };
  const dataUri =
    "data:application/json;base64," + Buffer.from(JSON.stringify(card)).toString("base64");

  log.info("Attaching agent card (setAgentURI)…");
  const tx2 = await registry.setAgentURI(agentId, dataUri);
  await tx2.wait();
  log.info(`Agent card attached (tx ${tx2.hash}).`);

  const scanChain =
    chainId === 42220 ? "celo" : chainId === 44787 ? "celo-alfajores" : String(chainId);
  const line = "─".repeat(54);
  log.info(line);
  log.info(`ERC-8004 agentId : ${agentId}`);
  log.info(`Registry         : ${registryAddress}`);
  log.info(`8004scan         : https://8004scan.io/agents/${scanChain}/${agentId}`);
  log.info(line);
}

main().catch((err) => {
  log.error("Registration failed", err);
  process.exit(1);
});
