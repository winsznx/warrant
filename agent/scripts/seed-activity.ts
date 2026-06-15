/**
 * Demonstration seeder: creates a small set of DIVERSE warrants across all four
 * condition modes (varied amounts, rules, and realistic proof content), then
 * submits proof so the running agent releases them.
 *
 * This is for dogfooding / the demo video — it deliberately produces *varied*,
 * realistic activity, not identical spam. For genuine Track-2 volume, get real
 * users on the live MiniPay app; do NOT mass-generate to game the metrics — the
 * judges manually review for sybil activity.
 *
 * Env: AGENT_PRIVATE_KEY, WARRANT_CONTRACT_ADDRESS, CELO_RPC_URL.
 * Optional: SEED_COUNT (default = number of scenarios), SEED_DELAY_MS (default 9000).
 */
import { ethers } from "ethers";
import { readFileSync } from "node:fs";

const RPC = process.env.CELO_RPC_URL ?? "https://forno.celo.org";
const KEY = process.env.AGENT_PRIVATE_KEY!;
const CONTRACT = process.env.WARRANT_CONTRACT_ADDRESS!;
const CUSD = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
const ZERO = "0x0000000000000000000000000000000000000000";
const ZERO32 = "0x" + "0".repeat(64);

const WARRANT_ABI = JSON.parse(
  readFileSync(new URL("../src/abi/WarrantAgent.json", import.meta.url), "utf8"),
) as ethers.InterfaceAbi;
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

interface Scenario {
  label: string;
  conditionType: number; // 0 RECEIPT, 1 DELIVERY, 2 MILESTONE, 3 MANUAL
  amount: string;
  ruleURI: string;
  proof: Record<string, unknown>;
}

const RECEIPT_IMG = "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600";
const PACKAGE_IMG = "https://images.unsplash.com/photo-1566576912321-d58ddd7a2688?w=600";

const SCENARIOS: Scenario[] = [
  {
    label: "MANUAL · school fees remittance",
    conditionType: 3,
    amount: "0.10",
    ruleURI: "School fees — Term 2 at Bright Future Academy, student Amara O.",
    proof: { description: "Term 2 tuition receipt uploaded and stamped by the bursar." },
  },
  {
    label: "RECEIPT · groceries reimbursement",
    conditionType: 0,
    amount: "0.08",
    ruleURI: JSON.stringify({ maxAmount: 25, merchant: "Shoprite" }),
    proof: { description: "Shoprite grocery receipt — 18.40 total", imageUrl: RECEIPT_IMG },
  },
  {
    label: "MILESTONE · open-source contribution",
    conditionType: 2,
    amount: "0.15",
    ruleURI: JSON.stringify({ owner: "celo-org", repo: "celo-composer", branch: "main" }),
    proof: {
      description: "Feature PR merged to main.",
      prUrl: "https://github.com/celo-org/celo-composer/pull/1",
    },
  },
  {
    label: "DELIVERY · Nairobi parcel handoff",
    conditionType: 1,
    amount: "0.12",
    ruleURI: JSON.stringify({ targetLat: -1.2921, targetLng: 36.8219, radiusMeters: 400 }),
    proof: {
      description: "Parcel delivered to Nairobi CBD, signed for.",
      lat: -1.2921,
      lng: 36.8219,
      imageUrl: PACKAGE_IMG,
    },
  },
  {
    label: "MANUAL · freelance design payout",
    conditionType: 3,
    amount: "0.06",
    ruleURI: "Freelance: logo pack delivered (SVG + PNG) with two revisions.",
    proof: { description: "Final logo files delivered and approved by the client." },
  },
  {
    label: "DELIVERY · Accra dropoff",
    conditionType: 1,
    amount: "0.09",
    ruleURI: JSON.stringify({ targetLat: 5.6037, targetLng: -0.187, radiusMeters: 400 }),
    proof: {
      description: "Package left at the Accra address as agreed.",
      lat: 5.6037,
      lng: -0.187,
      imageUrl: PACKAGE_IMG,
    },
  },
];

async function main(): Promise<void> {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(KEY, provider);
  const warrant = new ethers.Contract(CONTRACT, WARRANT_ABI, wallet);
  const cusd = new ethers.Contract(CUSD, ERC20_ABI, wallet);

  const count = Number(process.env.SEED_COUNT || SCENARIOS.length);
  const delayMs = Number(process.env.SEED_DELAY_MS || 9000);
  const fee: bigint = await warrant.verificationFee();

  // One generous approval up front.
  const totalNeeded = SCENARIOS.reduce(
    (acc, s) => acc + ethers.parseUnits(s.amount, 18) + fee,
    0n,
  );
  const allowance: bigint = await cusd.allowance(wallet.address, CONTRACT);
  if (allowance < totalNeeded) {
    console.log("Approving cUSD for seeding…");
    await (await cusd.approve(CONTRACT, totalNeeded * 2n)).wait();
  }

  for (let i = 0; i < count; i++) {
    const s = SCENARIOS[i % SCENARIOS.length];
    const amount = ethers.parseUnits(s.amount, 18);
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 7 * 86_400);
    const payout = { token: ZERO, exchangeProvider: ZERO, exchangeId: ZERO32 };

    console.log(`\n[${i + 1}/${count}] ${s.label} (${s.amount} cUSD)`);
    const createRcpt = await (
      await warrant.createWarrant(ZERO, amount, s.conditionType, s.ruleURI, expiresAt, payout)
    ).wait();

    let warrantId: bigint | null = null;
    for (const entry of createRcpt.logs) {
      try {
        const parsed = warrant.interface.parseLog(entry);
        if (parsed?.name === "WarrantCreated") {
          warrantId = parsed.args.warrantId as bigint;
          break;
        }
      } catch {
        /* skip */
      }
    }
    if (warrantId === null) {
      console.error("  no WarrantCreated event, skipping");
      continue;
    }

    const proofURI = JSON.stringify(s.proof);
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes(proofURI));
    await (await warrant.submitProof(warrantId, proofHash, proofURI)).wait();
    console.log(`  warrant ${warrantId} created + proof submitted — agent will release it.`);

    if (i < count - 1) await new Promise((r) => setTimeout(r, delayMs));
  }

  console.log(`\nSeeded ${count} warrants. The running agent verifies and releases each.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
