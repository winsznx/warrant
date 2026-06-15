export interface ProofUploadResult {
  cid: string;
  /** Gateway URL for direct viewing (e.g. images). */
  url: string;
  /** Canonical `ipfs://<cid>` URI stored on-chain as the proof reference. */
  uri: string;
}

const IPFS_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://gateway.pinata.cloud/ipfs/";

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? res.statusText;
  } catch {
    return res.statusText || `Upload failed (${res.status})`;
  }
}

/**
 * Pin the structured proof payload (JSON) and return its IPFS reference.
 * `fetcher` lets the caller inject an x402-paying fetch; defaults to plain fetch.
 */
export async function uploadProofJson(
  data: Record<string, unknown>,
  fetcher: typeof fetch = fetch,
): Promise<ProofUploadResult> {
  const res = await fetcher("/api/proof", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "json", data }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as ProofUploadResult;
}

/** Pin a binary file (proof photo/document) and return its IPFS reference. */
export async function uploadProofFile(
  file: File,
  fetcher: typeof fetch = fetch,
): Promise<ProofUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetcher("/api/proof", { method: "POST", body: form });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as ProofUploadResult;
}

/** Resolve any `ipfs://` URI to an HTTP gateway URL for rendering. */
export function resolveIpfsUrl(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    return IPFS_GATEWAY + uri.slice("ipfs://".length);
  }
  return uri;
}
