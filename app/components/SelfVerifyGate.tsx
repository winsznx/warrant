"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { SelfQRcodeWrapper, SelfAppBuilder, type SelfApp } from "@selfxyz/qrcode";
import { ShieldCheck } from "lucide-react";
import {
  SELF_APP_NAME,
  SELF_SCOPE,
  SELF_ENDPOINT,
  SELF_ENDPOINT_TYPE,
} from "@/lib/self";

/**
 * Proof-of-human gate. Renders a Self QR; on a verified scan, `onVerified`
 * fires. Loaded via `next/dynamic({ ssr: false })` so the heavy SDK never
 * runs server-side and is only fetched when a gated claim is opened.
 */
export default function SelfVerifyGate({ onVerified }: { onVerified: () => void }) {
  const { address } = useAccount();
  const [selfApp, setSelfApp] = useState<SelfApp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    try {
      const app = new SelfAppBuilder({
        version: 2,
        appName: SELF_APP_NAME,
        scope: SELF_SCOPE,
        endpoint: SELF_ENDPOINT,
        endpointType: SELF_ENDPOINT_TYPE,
        userId: address,
        userIdType: "hex",
        disclosures: { minimumAge: 18, ofac: true },
        userDefinedData: "",
      }).build();
      setSelfApp(app);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [address]);

  return (
    <div
      className="glass-card"
      style={{ padding: "32px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", textAlign: "center" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--primary-gold)", fontWeight: 700 }}>
        <ShieldCheck size={20} />
        <span>Verify you&apos;re a unique human</span>
      </div>

      {!address ? (
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Connect your wallet to verify.</p>
      ) : error ? (
        <p style={{ color: "var(--error-red)", fontSize: "0.85rem" }}>{error}</p>
      ) : !selfApp ? (
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Preparing verification…</p>
      ) : (
        <>
          <SelfQRcodeWrapper
            selfApp={selfApp}
            onSuccess={onVerified}
            onError={() => setError("Verification failed — please try again.")}
          />
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", maxWidth: "320px" }}>
            Scan with the Self app to prove personhood with a zero-knowledge proof. No
            personal data is shared — only that you&apos;re a real, unique human.
          </p>
        </>
      )}
    </div>
  );
}
