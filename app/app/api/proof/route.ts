import { NextRequest, NextResponse } from "next/server";
import { enforceX402 } from "@/lib/x402.server";

export const runtime = "nodejs";

const PINATA_JWT = process.env.PINATA_JWT;
const GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY ??
  process.env.IPFS_GATEWAY ??
  "https://gateway.pinata.cloud/ipfs/";

const PINATA_API = "https://api.pinata.cloud/pinning";
const INLINE_FALLBACK_LIMIT = 1_500_000; // ~1.5MB cap for dev data-URI fallback

interface UploadResult {
  cid: string;
  url: string;
  uri: string;
}

function pinned(cid: string): UploadResult {
  return { cid, url: GATEWAY + cid, uri: `ipfs://${cid}` };
}

async function pinJson(data: unknown): Promise<string> {
  const res = await fetch(`${PINATA_API}/pinJSONToIPFS`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${PINATA_JWT}`,
    },
    body: JSON.stringify({
      pinataContent: data,
      pinataMetadata: { name: "warrant-proof.json" },
    }),
  });
  if (!res.ok) {
    throw new Error(`Pinata JSON pin failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { IpfsHash: string };
  return json.IpfsHash;
}

async function pinFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append(
    "pinataMetadata",
    JSON.stringify({ name: file.name || "warrant-proof" }),
  );
  const res = await fetch(`${PINATA_API}/pinFileToIPFS`, {
    method: "POST",
    headers: { authorization: `Bearer ${PINATA_JWT}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Pinata file pin failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { IpfsHash: string };
  return json.IpfsHash;
}

export async function POST(req: NextRequest) {
  // x402 micropayment gate (default-off; returns 402 until paid when enabled).
  const paymentRequired = await enforceX402(req);
  if (paymentRequired) return paymentRequired;

  try {
    const contentType = req.headers.get("content-type") ?? "";

    // Binary proof (photo/document) upload.
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      if (!PINATA_JWT) {
        const buf = Buffer.from(await file.arrayBuffer());
        if (buf.length > INLINE_FALLBACK_LIMIT) {
          return NextResponse.json(
            { error: "PINATA_JWT is not configured and the file is too large for the dev fallback." },
            { status: 503 },
          );
        }
        const dataUri = `data:${file.type || "application/octet-stream"};base64,${buf.toString("base64")}`;
        return NextResponse.json({ cid: "inline", url: dataUri, uri: dataUri });
      }

      return NextResponse.json(pinned(await pinFile(file)));
    }

    // Structured JSON proof payload.
    const body = (await req.json()) as { kind?: string; data?: unknown };
    const data = body?.kind === "json" ? body.data : body;
    if (data === undefined || data === null) {
      return NextResponse.json({ error: "No data provided" }, { status: 400 });
    }

    if (!PINATA_JWT) {
      // The agent parses inline JSON proofs directly, so the dev flow works
      // without IPFS by returning the payload as an inline URI.
      const inline = JSON.stringify(data);
      return NextResponse.json({ cid: "inline", url: "", uri: inline });
    }

    return NextResponse.json(pinned(await pinJson(data)));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/proof]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
