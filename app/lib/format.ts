import { formatUnits } from "viem";
import { CUSD_DECIMALS } from "./config";

export function truncateAddress(address?: string, lead = 6, tail = 4): string {
  if (!address) return "";
  if (address.length <= lead + tail) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/** Format a cUSD amount (18-decimal bigint) with a trimmed, fixed-precision display. */
export function formatCusd(amount: bigint, maxFractionDigits = 2): string {
  const raw = formatUnits(amount, CUSD_DECIMALS);
  const num = Number(raw);
  if (Number.isNaN(num)) return raw;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  });
}

export function timeLeft(expiresAtMs: number, nowMs: number = Date.now()): string {
  const diff = expiresAtMs - nowMs;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86_400_000);
  if (days >= 1) return `${days}d left`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours >= 1) return `${hours}h left`;
  const minutes = Math.max(1, Math.floor(diff / 60_000));
  return `${minutes}m left`;
}

/**
 * Surface a concise, human-readable message from viem/wagmi contract errors,
 * which otherwise carry deep multi-line stack details.
 */
export function readableError(error: unknown): string {
  if (!error) return "Unknown error";
  const err = error as {
    shortMessage?: string;
    details?: string;
    message?: string;
    cause?: { shortMessage?: string; message?: string };
  };
  const candidate =
    err.cause?.shortMessage ??
    err.shortMessage ??
    err.cause?.message ??
    err.details ??
    err.message ??
    String(error);

  if (/user rejected|denied transaction|user denied/i.test(candidate)) {
    return "Transaction rejected in wallet.";
  }
  return candidate.split("\n")[0].slice(0, 200);
}
