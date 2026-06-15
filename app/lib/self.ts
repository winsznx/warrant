/**
 * Self Protocol proof-of-human integration.
 *
 * Per PRD §4.4, Self verification is surfaced in the UI but is **non-blocking**
 * by default (test wallets). Setting `NEXT_PUBLIC_SELF_REQUIRED=true` plus a
 * scope + verification endpoint turns the claim flow into a gated, proof-of-human
 * flow using the open-source Self SDK (`@selfxyz/qrcode` + `@selfxyz/core`).
 */
import type { Address } from "viem";

export const SELF_REQUIRED = process.env.NEXT_PUBLIC_SELF_REQUIRED === "true";
export const SELF_APP_ID = process.env.NEXT_PUBLIC_SELF_APP_ID ?? "";
export const SELF_APP_NAME = process.env.NEXT_PUBLIC_SELF_APP_NAME ?? "Warrant";
/** Scope seed (<=31 ASCII chars); MUST match the backend verifier scope. */
export const SELF_SCOPE = process.env.NEXT_PUBLIC_SELF_SCOPE ?? "warrant-human";
/** Public URL of the verification route (no localhost — the Self app POSTs here). */
export const SELF_ENDPOINT = process.env.NEXT_PUBLIC_SELF_ENDPOINT ?? "";

type EndpointType = "https" | "staging_https" | "celo" | "staging_celo";
export const SELF_ENDPOINT_TYPE = (process.env.NEXT_PUBLIC_SELF_ENDPOINT_TYPE ??
  "staging_https") as EndpointType;

/** True when Self proof-of-human gating is both required and configured. */
export function isSelfConfigured(): boolean {
  return SELF_REQUIRED && SELF_ENDPOINT.length > 0 && SELF_SCOPE.length > 0;
}

export interface SelfIdentityStatus {
  verified: boolean;
  required: boolean;
}

/** Non-blocking unless Self is required and configured. */
export function getSelfIdentityStatus(_address: Address): SelfIdentityStatus {
  return { verified: !isSelfConfigured(), required: isSelfConfigured() };
}
