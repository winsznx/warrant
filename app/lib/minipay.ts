import type { Address } from "viem";
import { CUSD_ADDRESS } from "./config";

interface MiniPayEthereum {
  isMiniPay?: boolean;
}

/** True when running inside the MiniPay in-app browser (injected provider). */
export function isMiniPay(): boolean {
  if (typeof window === "undefined") return false;
  const eth = (window as unknown as { ethereum?: MiniPayEthereum }).ethereum;
  return Boolean(eth?.isMiniPay);
}

/**
 * Transaction extras that let MiniPay users pay gas in cUSD instead of CELO
 * (Celo fee-currency abstraction, CIP-64). Only applied inside MiniPay, which
 * supports fee-currency transactions; other wallets pay gas in CELO as usual.
 */
export function feeCurrencyExtras(): { feeCurrency: Address } | Record<string, never> {
  return isMiniPay() ? { feeCurrency: CUSD_ADDRESS } : {};
}
