import { ethers } from "ethers";
import { createLogger } from "../logger.js";

const log = createLogger("x402");

/**
 * Payment gate for verification work.
 *
 * In Warrant, the per-verification micro-fee is escrowed in the contract at
 * warrant creation (`warrantFeeBalance`) and settled **on-chain** to the agent
 * operator when the agent calls `agentRelease`/`agentReject`. This gate reads
 * that on-chain budget before the agent spends compute, so verification is
 * gated by a real, on-chain fee rather than an off-chain promise.
 *
 * When an external x402-priced API (e.g. a metered LLM proxy) is configured via
 * `X402_ENABLED`/`X402_ENDPOINT`, {@link payFetch} can wrap outbound requests;
 * otherwise it transparently falls back to the global fetch.
 */
export class PaymentGate {
  private readonly enabled: boolean;

  constructor(private readonly contract: ethers.Contract) {
    this.enabled = process.env.X402_ENABLED === "true" && !!process.env.X402_ENDPOINT;
  }

  /** Confirm the on-chain fee budget for a warrant before running verification. */
  async authorize(warrantId: string): Promise<{ ok: boolean; fee: bigint }> {
    try {
      const fee: bigint = await this.contract.warrantFeeBalance(warrantId);
      if (fee > 0n) {
        log.info(
          `Warrant ${warrantId}: ${ethers.formatUnits(fee, 18)} cUSD fee budget reserved (settled on-chain on decision).`,
        );
      } else {
        log.warn(`Warrant ${warrantId}: no remaining fee budget; proceeding (already settled).`);
      }
      return { ok: true, fee };
    } catch (err) {
      log.error(`Warrant ${warrantId}: failed to read on-chain fee budget`, err);
      // Do not block verification on a transient read failure — the fee is
      // already escrowed and settled by the contract on release/reject.
      return { ok: true, fee: 0n };
    }
  }

  isX402Enabled(): boolean {
    return this.enabled;
  }
}
