import { createLogger } from "./logger.js";
import type { ProofPayload } from "./types.js";

const log = createLogger("proof");

const IPFS_GATEWAY = process.env.IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs/";

/** Resolve an `ipfs://` URI to an HTTP gateway URL; pass through everything else. */
export function resolveUri(uri: string): string {
  if (uri.startsWith("ipfs://")) return IPFS_GATEWAY + uri.slice("ipfs://".length);
  return uri;
}

/**
 * Resolve a warrant's `proofURI` into a structured {@link ProofPayload}.
 * Supports inline JSON, `data:` URIs, `ipfs://` references, and HTTP(S) URLs.
 */
export async function fetchProof(proofURI: string): Promise<ProofPayload> {
  const trimmed = proofURI.trim();

  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed) as ProofPayload;
    } catch (err) {
      log.error("Failed to parse inline JSON proof", err);
      return { description: trimmed };
    }
  }

  if (trimmed.startsWith("data:")) {
    return { imageUrl: trimmed };
  }

  if (
    trimmed.startsWith("ipfs://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    const url = resolveUri(trimmed);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        return (await res.json()) as ProofPayload;
      }
      const text = await res.text();
      try {
        return JSON.parse(text) as ProofPayload;
      } catch {
        // Not JSON — treat the resource itself as the image/document.
        return { description: text.slice(0, 500), imageUrl: url };
      }
    } catch (err) {
      log.error(`Failed to fetch proof from ${url}`, err);
      return { description: trimmed };
    }
  }

  return { description: trimmed };
}
