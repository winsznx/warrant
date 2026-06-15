/**
 * Lightweight x402 config (no heavy imports — safe in any bundle). The thirdweb
 * SDK is dynamically imported only when the gate runs, so it never enters the
 * client bundle or unconfigured builds.
 */
import type { Address } from "viem";

export const X402_ENABLED = process.env.X402_ENABLED === "true";

/** Where the cUSD micropayment lands (the agent operator by default). */
export const X402_PAY_TO = (process.env.X402_PAY_TO ??
  "0x7273dE585311a5139Ef83f0F6Dbb29F3e57b3389") as Address;

/** Price per verification, in cUSD wei (18 decimals). Default 0.01 cUSD. */
export const X402_PRICE_CUSD = process.env.X402_PRICE_CUSD ?? "10000000000000000";

export const X402_CUSD_ADDRESS =
  "0x765DE816845861e75A25fCA122bb6898B8B1282a" as Address;

// cUSD's on-chain EIP-712 domain, confirmed by reconstructing its
// DOMAIN_SEPARATOR (0x87dc…2f97): name "Mento Dollar", version "3" (the token
// was renamed cUSD → USDm; the permit version tracks the implementation, now
// "3"). Standard full domain — no salt. Overridable via env without a code change.
export const X402_CUSD_EIP712_NAME = process.env.X402_CUSD_NAME ?? "Mento Dollar";
export const X402_CUSD_EIP712_VERSION = process.env.X402_CUSD_VERSION ?? "3";
// cUSD is an EIP-2612 (permit) token, not EIP-3009 (transferWithAuthorization).
export const X402_CUSD_PRIMARY_TYPE = (process.env.X402_CUSD_PRIMARY_TYPE ?? "Permit") as
  | "Permit"
  | "TransferWithAuthorization";

/** Canonical resource URL the client signs over (must match production). */
export const X402_RESOURCE_URL =
  process.env.X402_RESOURCE_URL ?? "https://trywarrant.xyz/api/proof";

/** Public flag for the client (auto-pay) — mirror of X402_ENABLED. */
export const X402_CLIENT_ENABLED = process.env.NEXT_PUBLIC_X402_ENABLED === "true";
