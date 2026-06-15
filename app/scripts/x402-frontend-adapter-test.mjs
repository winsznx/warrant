// Validates the FRONTEND signing path: a viem walletClient (stand-in for the
// wagmi wallet) + a manual thirdweb Account adapter that delegates signTypedData
// to it, wrapped via createWalletAdapter — exactly what lib/x402Client.ts does.
import { createThirdwebClient, defineChain } from "thirdweb";
import { createWalletAdapter } from "thirdweb/wallets";
import { wrapFetchWithPayment } from "thirdweb/x402";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { readFileSync } from "node:fs";

const RPC = "https://forno.celo.org";
const ENDPOINT = process.env.X402_TEST_ENDPOINT || "http://localhost:3000/api/proof";

const opKey = /^DEPLOYER_PRIVATE_KEY=(.+)$/m
  .exec(readFileSync("/Users/mac/warrant/contracts/.env", "utf8"))?.[1]?.trim().replace(/['"]/g, "");
const secretKey = /^THIRDWEB_SECRET_KEY=(.+)$/m
  .exec(readFileSync("/Users/mac/warrant/app/.env.local", "utf8"))?.[1]?.trim().replace(/['"]/g, "");
if (!opKey || !secretKey) throw new Error("missing keys");

const pk = opKey.startsWith("0x") ? opKey : `0x${opKey}`;
const viemAccount = privateKeyToAccount(pk);
const walletClient = createWalletClient({ account: viemAccount, chain: celo, transport: http(RPC) });

const client = createThirdwebClient({ secretKey });

// === identical to lib/x402Client.ts ===
const adaptedAccount = {
  address: viemAccount.address,
  signMessage: (params) => walletClient.signMessage({ account: viemAccount, ...params }),
  signTypedData: (typedData) => walletClient.signTypedData({ account: viemAccount, ...typedData }),
};
const chain = defineChain(walletClient.chain?.id ?? 42220);
const wallet = createWalletAdapter({ client, adaptedAccount, chain, onDisconnect: () => {}, switchChain: async () => {} });
const fetchWithPay = wrapFetchWithPayment(fetch, client, wallet, { maxValue: 10n ** 18n });
// =======================================

console.log("frontend-adapter test → POST", ENDPOINT);
const res = await fetchWithPay(ENDPOINT, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ kind: "json", data: { description: "x402 frontend-adapter test" } }),
});
console.log("HTTP status:", res.status);
console.log("body:", (await res.text()).slice(0, 400));
