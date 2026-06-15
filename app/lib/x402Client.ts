"use client";

import { X402_CLIENT_ENABLED } from "./x402.config";

const THIRDWEB_CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

/**
 * Returns a `fetch` that auto-pays x402 challenges from the connected wagmi
 * wallet, using thirdweb's x402 client — the same dialect as the server gate
 * (`lib/x402.server.ts`). The wallet signs an EIP-712 cUSD authorization
 * (`PAYMENT-SIGNATURE` header) and the request is retried; thirdweb's
 * facilitator settles it on-chain.
 *
 * Fail-open: when x402 is disabled, the thirdweb client id is missing, no
 * wallet is connected, or anything throws, this returns plain `fetch` so the
 * proof upload always succeeds (just unmetered). The heavy `thirdweb` SDK is
 * dynamically imported, so it never enters the bundle unless x402 is on.
 */
export async function getX402Fetch(
  // wagmi's WalletClient carries heavy transport/chain generics that don't align
  // with viem's bare types; we only touch a few fields, so accept loosely
  // (runtime is guarded below).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletClient: any,
  // Kept for call-site compatibility; thirdweb uses its own RPC client.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _publicClient?: any,
): Promise<typeof fetch> {
  if (!X402_CLIENT_ENABLED || !THIRDWEB_CLIENT_ID || !walletClient?.account) {
    return fetch;
  }

  try {
    const { createThirdwebClient, defineChain } = await import("thirdweb");
    const { createWalletAdapter } = await import("thirdweb/wallets");
    const { wrapFetchWithPayment } = await import("thirdweb/x402");

    const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });
    const viemAccount = walletClient.account;

    // Minimal thirdweb Account that delegates signing to the wagmi wallet.
    // thirdweb's x402 sign path only calls `address` + `signTypedData`; the
    // permit-nonce read goes through `client`'s RPC, not the account. Cast
    // bridges the viem wallet's signer shape onto thirdweb's Account type.
    const adaptedAccount = {
      address: viemAccount.address,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signMessage: (params: any) => walletClient.signMessage({ account: viemAccount, ...params }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signTypedData: (typedData: any) => walletClient.signTypedData({ account: viemAccount, ...typedData }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const chain = defineChain(walletClient.chain?.id ?? 42220);
    const wallet = createWalletAdapter({
      client,
      adaptedAccount,
      chain,
      onDisconnect: () => {},
      switchChain: async () => {},
    });

    return wrapFetchWithPayment(fetch, client, wallet) as typeof fetch;
  } catch (err) {
    console.error(
      "[x402] client init failed; using plain fetch:",
      err instanceof Error ? err.message : err,
    );
    return fetch;
  }
}
