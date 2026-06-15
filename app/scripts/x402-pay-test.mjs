// Headless x402 settlement test using thirdweb's client (matches the thirdweb
// server dialect). Drives a viem wallet (operator key) through the full
// pay-per-verification round-trip against a locally running /api/proof.
import { createThirdwebClient } from "thirdweb";
import { privateKeyToAccount as twPrivateKeyToAccount, createWalletAdapter } from "thirdweb/wallets";
import { celo as twCelo } from "thirdweb/chains";
import { wrapFetchWithPayment } from "thirdweb/x402";
import { createWalletClient, createPublicClient, http, maxUint256, erc20Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { readFileSync } from "node:fs";

const RPC = "https://forno.celo.org";
const CUSD = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const ENDPOINT = process.env.X402_TEST_ENDPOINT || "http://localhost:3000/api/proof";

const opKey = /^DEPLOYER_PRIVATE_KEY=(.+)$/m
  .exec(readFileSync("/Users/mac/warrant/contracts/.env", "utf8"))?.[1]
  ?.trim().replace(/['"]/g, "");
const secretKey = /^THIRDWEB_SECRET_KEY=(.+)$/m
  .exec(readFileSync("/Users/mac/warrant/app/.env.local", "utf8"))?.[1]
  ?.trim().replace(/['"]/g, "");
if (!opKey || !secretKey) throw new Error("missing operator key or thirdweb secret key");

const account = privateKeyToAccount(opKey);
console.log("payer/recipient:", account.address);
const viemWallet = createWalletClient({ account, chain: celo, transport: http(RPC) });
const publicClient = createPublicClient({ chain: celo, transport: http(RPC) });

// 1. One-time Permit2 allowance for cUSD.
const allowance = await publicClient.readContract({
  address: CUSD, abi: erc20Abi, functionName: "allowance", args: [account.address, PERMIT2],
});
console.log("Permit2 allowance:", allowance.toString());
if (allowance < 10n ** 16n) {
  console.log("approving Permit2 for cUSD…");
  const hash = await viemWallet.writeContract({
    address: CUSD, abi: erc20Abi, functionName: "approve", args: [PERMIT2, maxUint256],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("approved ✓", hash);
}

// 2. thirdweb client + wallet (local account → wallet adapter, works headless;
//    fromViem can't connect a local-account wallet because eth_accounts over an
//    HTTP transport returns nothing — the browser's injected provider would).
const client = createThirdwebClient({ secretKey });
const pk = opKey.startsWith("0x") ? opKey : `0x${opKey}`;
const twAccount = twPrivateKeyToAccount({ client, privateKey: pk });
const wallet = createWalletAdapter({
  client,
  adaptedAccount: twAccount,
  chain: twCelo,
  onDisconnect: () => {},
  switchChain: () => {},
});
const fetchWithPay = wrapFetchWithPayment(fetch, client, wallet, { maxValue: 10n ** 18n });

// 3. Pay + post.
console.log("POST", ENDPOINT, "with thirdweb x402 auto-pay…");
const res = await fetchWithPay(ENDPOINT, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ kind: "json", data: { description: "x402 headless settlement test" } }),
});
console.log("HTTP status:", res.status);
console.log("body:", (await res.text()).slice(0, 600));
const payResp = res.headers.get("payment-response") || res.headers.get("x-payment-response");
if (payResp) {
  try {
    console.log("payment-response:", Buffer.from(payResp, "base64").toString("utf8").slice(0, 600));
  } catch {
    console.log("payment-response (raw):", payResp.slice(0, 300));
  }
}
