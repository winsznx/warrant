/**
 * One-off mainnet end-to-end exercise: approve cUSD, create an open-claim MANUAL
 * warrant, and submit proof. The agent daemon then releases it autonomously.
 * Prints `WARRANT_ID=<n>` and `START_BLOCK=<n>` for the orchestration harness.
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

async function main(): Promise<void> {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(KEY, provider);
  const warrant = new ethers.Contract(CONTRACT, WARRANT_ABI, wallet);
  const cusd = new ethers.Contract(CUSD, ERC20_ABI, wallet);

  const amount = ethers.parseUnits("0.1", 18);
  const fee: bigint = await warrant.verificationFee();
  const total = amount + fee;

  const allowance: bigint = await cusd.allowance(wallet.address, CONTRACT);
  if (allowance < total) {
    console.log("Approving cUSD…");
    await (await cusd.approve(CONTRACT, total)).wait();
  }

  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 86_400);
  const payout = { token: ZERO, exchangeProvider: ZERO, exchangeId: ZERO32 };

  console.log("Creating warrant (MANUAL, open claim, 0.1 cUSD)…");
  const createTx = await warrant.createWarrant(
    ZERO,
    amount,
    3, // MANUAL
    "Pay on task completion",
    expiresAt,
    payout,
  );
  const createRcpt = await createTx.wait();
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
  if (warrantId === null) throw new Error("no WarrantCreated event");
  console.log(`Created warrant ${warrantId} (tx ${createTx.hash}, block ${createRcpt.blockNumber}).`);

  const proofURI = JSON.stringify({
    description: "Task completed successfully — deliverable shipped.",
  });
  const proofHash = ethers.keccak256(ethers.toUtf8Bytes(proofURI));
  console.log("Submitting proof…");
  const proofTx = await warrant.submitProof(warrantId, proofHash, proofURI);
  const proofRcpt = await proofTx.wait();
  console.log(`Proof submitted (tx ${proofTx.hash}, block ${proofRcpt.blockNumber}).`);

  console.log(`WARRANT_ID=${warrantId}`);
  console.log(`START_BLOCK=${createRcpt.blockNumber}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
