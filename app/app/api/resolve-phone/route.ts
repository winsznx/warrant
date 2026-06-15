import { NextRequest, NextResponse } from "next/server";

// @celo/identity uses native WASM (BLS blinding) — requires the Node runtime.
export const runtime = "nodejs";

const E164 = /^\+[1-9]\d{6,14}$/;

export async function POST(req: NextRequest) {
  let phone: string;
  try {
    ({ phone } = (await req.json()) as { phone: string });
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!E164.test(phone)) {
    return NextResponse.json({ error: "invalid E.164 phone number" }, { status: 400 });
  }

  // SocialConnect is opt-in: without a funded issuer key, resolution is disabled
  // and the caller falls back to an open-claim warrant.
  if (!process.env.SOCIALCONNECT_ISSUER_PRIVATE_KEY) {
    return NextResponse.json({ address: null, configured: false });
  }

  try {
    const { resolvePhoneToAddress } = await import("@/lib/socialconnect");
    const address = await resolvePhoneToAddress(phone);
    return NextResponse.json({ address, configured: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/resolve-phone]", message);
    return NextResponse.json({ address: null, configured: true, error: message }, { status: 502 });
  }
}
