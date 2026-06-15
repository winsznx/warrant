import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Structural view of the (beta) @selfxyz/core surface we use, so this route
// compiles against the documented API and tolerates minor beta drift; any
// real mismatch surfaces at runtime (the feature is opt-in / default-off).
interface SelfVerifier {
  verify: (
    attestationId: unknown,
    proof: unknown,
    pubSignals: unknown,
    userContextData: unknown,
  ) => Promise<unknown>;
}
interface SelfCoreModule {
  SelfBackendVerifier: new (
    scope: string,
    endpoint: string,
    mockPassport: boolean,
    allowedIds: unknown,
    configStore: unknown,
    userIdType: string,
  ) => SelfVerifier;
  DefaultConfigStore: new (cfg: Record<string, unknown>) => unknown;
  AllIds: unknown;
}

export async function POST(req: NextRequest) {
  const scope = process.env.NEXT_PUBLIC_SELF_SCOPE;
  const endpoint = process.env.NEXT_PUBLIC_SELF_ENDPOINT;
  if (!scope || !endpoint) {
    return NextResponse.json(
      { status: "error", message: "Self verification is not configured" },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ status: "error", message: "invalid body" }, { status: 400 });
  }

  const attestationId = body.attestation_id ?? body.attestationId;
  const proof = body.proof;
  const pubSignals = body.pub_signals ?? body.publicSignals;
  const userContextData = body.user_context_data ?? body.userContextData;

  try {
    const core = (await import("@selfxyz/core")) as unknown as SelfCoreModule;
    const configStore = new core.DefaultConfigStore({ minimumAge: 18, ofac: true });
    const mock = (process.env.NEXT_PUBLIC_SELF_ENDPOINT_TYPE ?? "staging_https").startsWith("staging");
    const verifier = new core.SelfBackendVerifier(scope, endpoint, mock, core.AllIds, configStore, "hex");
    const result = await verifier.verify(attestationId, proof, pubSignals, userContextData);
    return NextResponse.json({ status: "success", result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/self/verify]", message);
    return NextResponse.json({ status: "error", result: false, message }, { status: 400 });
  }
}
