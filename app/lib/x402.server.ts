import "server-only";
import {
  X402_ENABLED,
  X402_PAY_TO,
  X402_PRICE_CUSD,
  X402_CUSD_ADDRESS,
  X402_CUSD_EIP712_NAME,
  X402_CUSD_EIP712_VERSION,
  X402_CUSD_PRIMARY_TYPE,
  X402_RESOURCE_URL,
} from "./x402.config";

/**
 * Enforce an x402 micropayment for a protected route.
 *
 * Returns a `Response` (HTTP 402 with payment requirements, or 402 retry) when
 * payment is required and not yet settled; returns `null` to let the request
 * proceed (payment settled, gate disabled, or — deliberately — on any
 * misconfiguration/error, so a broken gate never blocks the proof flow).
 *
 * thirdweb is dynamically imported so the heavy SDK only loads when the gate is
 * actually exercised.
 */
export async function enforceX402(req: Request): Promise<Response | null> {
  if (!X402_ENABLED) return null;

  const secretKey = process.env.THIRDWEB_SECRET_KEY;
  const serverWallet = process.env.X402_SERVER_WALLET_ADDRESS;
  if (!secretKey || !serverWallet) {
    console.warn("[x402] enabled but THIRDWEB_SECRET_KEY / X402_SERVER_WALLET_ADDRESS missing — gate skipped.");
    return null;
  }

  try {
    const { createThirdwebClient } = await import("thirdweb");
    const { settlePayment, facilitator } = await import("thirdweb/x402");
    const { celo } = await import("thirdweb/chains");

    // x402 v2 clients send the signed payment under `PAYMENT-SIGNATURE`; v1
    // clients use `X-PAYMENT`. Accept both (v2 first) — matches thirdweb's docs.
    const paymentData = req.headers.get("payment-signature") ?? req.headers.get("x-payment");

    if (process.env.X402_DEBUG === "true") {
      const hdr = paymentData;
      if (hdr) {
        try {
          console.log("[x402] incoming X-PAYMENT:", Buffer.from(hdr, "base64").toString("utf8").slice(0, 800));
        } catch {
          console.log("[x402] incoming X-PAYMENT (raw):", hdr.slice(0, 300));
        }
      } else {
        console.log("[x402] no X-PAYMENT header (challenge phase)");
      }
    }

    const client = createThirdwebClient({ secretKey });
    const twFacilitator = facilitator({
      client,
      serverWalletAddress: serverWallet,
      // Self-managed Vault: the access token authorizes the server wallet to sign.
      vaultAccessToken: process.env.THIRDWEB_VAULT_ACCESS_TOKEN,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await settlePayment({
      resourceUrl: X402_RESOURCE_URL,
      method: "POST",
      paymentData,
      payTo: X402_PAY_TO,
      network: celo,
      price: {
        amount: X402_PRICE_CUSD,
        asset: {
          address: X402_CUSD_ADDRESS,
          decimals: 18,
          eip712: {
            name: X402_CUSD_EIP712_NAME,
            version: X402_CUSD_EIP712_VERSION,
            primaryType: X402_CUSD_PRIMARY_TYPE,
          },
        },
      },
      facilitator: twFacilitator,
    });

    if (process.env.X402_DEBUG === "true") {
      console.log("[x402] settle result:", JSON.stringify(result, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
    }

    if (result?.status && result.status !== 200) {
      return new Response(JSON.stringify(result.responseBody ?? {}), {
        status: result.status,
        headers: result.responseHeaders ?? { "content-type": "application/json" },
      });
    }
    return null; // payment settled — proceed
  } catch (err) {
    // Fail open: never let an x402 error block the proof upload / break the demo.
    console.error("[x402] gate error (failing open):", err instanceof Error ? err.message : err);
    return null;
  }
}
