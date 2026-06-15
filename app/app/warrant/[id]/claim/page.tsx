"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import dynamic from "next/dynamic";
import { ArrowLeft, Send, Upload, MapPin, Loader2, AlertTriangle } from "lucide-react";
import { useWarrant, useSubmitProof, computeProofHash } from "@/lib/warrants";
import { uploadProofFile, uploadProofJson } from "@/lib/ipfs";
import { getX402Fetch } from "@/lib/x402Client";
import { readableError } from "@/lib/format";
import { isSelfConfigured } from "@/lib/self";
import { CONDITION_LABEL } from "@/components/ConditionIcon";

const SelfVerifyGate = dynamic(() => import("@/components/SelfVerifyGate"), {
  ssr: false,
});

function parseId(raw: string): bigint | null {
  try {
    const id = BigInt(raw);
    return id > 0n ? id : null;
  } catch {
    return null;
  }
}

type Phase = "idle" | "uploading";

export default function ClaimWarrantPage() {
  const params = useParams();
  const router = useRouter();
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const id = parseId(params.id as string);
  const { warrant, notFound, isLoading } = useWarrant(id ?? undefined);
  const { submit, step, error: txError, isBusy: txBusy } = useSubmitProof();

  const [description, setDescription] = useState("");
  const [prUrl, setPrUrl] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [selfVerified, setSelfVerified] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = phase === "uploading" || txBusy;
  const needsSelf = isSelfConfigured() && !selfVerified;

  if (id === null || notFound) {
    return (
      <div style={{ textAlign: "center", padding: "80px 0" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "16px" }}>Warrant Not Found</h2>
        <button onClick={() => router.push("/warrants")} className="btn btn-secondary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (isLoading || !warrant) {
    return (
      <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }}>
        <Loader2 size={28} style={{ animation: "spin 1s linear infinite", marginBottom: "12px" }} />
        <p>Loading…</p>
      </div>
    );
  }

  if (warrant.status !== "OPEN") {
    return (
      <div style={{ textAlign: "center", padding: "80px 0" }}>
        <h2 style={{ fontSize: "1.4rem", marginBottom: "8px" }}>This warrant is not open for claims</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: "20px" }}>Current status: {warrant.status}.</p>
        <button onClick={() => router.push(`/warrant/${id}`)} className="btn btn-secondary">
          View Warrant
        </button>
      </div>
    );
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  }

  function useMyLocation() {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
      },
      (err) => setGeoError(err.message || "Unable to read location."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  const type = warrant.conditionType;
  const requiresFile = type === "RECEIPT" || type === "DELIVERY";
  const canSubmit =
    isConnected &&
    !busy &&
    !needsSelf &&
    description.trim().length > 0 &&
    (!requiresFile || file !== null) &&
    (type !== "DELIVERY" || (lat !== "" && lng !== "")) &&
    (type !== "MILESTONE" || prUrl.trim().length > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !warrant || id === null) return;
    setUploadError(null);

    try {
      setPhase("uploading");

      // x402-paying fetch when enabled; plain fetch otherwise.
      const fetcher = await getX402Fetch(walletClient, publicClient);

      let imageUrl: string | undefined;
      if (file) {
        const uploaded = await uploadProofFile(file, fetcher);
        imageUrl = uploaded.url;
      }

      const payload: Record<string, unknown> = { description: description.trim() };
      if (imageUrl) payload.imageUrl = imageUrl;
      if (type === "DELIVERY") {
        payload.lat = Number.parseFloat(lat);
        payload.lng = Number.parseFloat(lng);
      }
      if (type === "MILESTONE") payload.prUrl = prUrl.trim();

      const proof = await uploadProofJson(payload, fetcher);
      setPhase("idle");

      const ok = await submit({
        warrantId: id,
        proofHash: computeProofHash(proof.uri),
        proofURI: proof.uri,
      });
      if (ok) router.push(`/warrant/${id}`);
    } catch (err) {
      setPhase("idle");
      setUploadError(readableError(err));
    }
  }

  const submitLabel =
    phase === "uploading"
      ? "Uploading proof to IPFS…"
      : step === "submitting"
        ? "Submitting on-chain…"
        : step === "confirming"
          ? "Confirming…"
          : "Submit to Agent Escrow";

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto", padding: "40px 0" }}>
      <button
        onClick={() => router.push(`/warrant/${id}`)}
        style={{ display: "flex", alignItems: "center", gap: "8px", background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", marginBottom: "24px" }}
      >
        <ArrowLeft size={16} />
        <span>Back to Escrow</span>
      </button>

      <div className="glass-card" style={{ padding: "40px" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "8px" }}>Submit Claim Proof</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "32px" }}>
          {CONDITION_LABEL[type]} · Warrant #{warrant.id.toString()} · {warrant.amountFormatted} cUSD
        </p>

        {needsSelf && (
          <div style={{ marginBottom: "28px" }}>
            <SelfVerifyGate onVerified={() => setSelfVerified(true)} />
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {type === "MILESTONE" && (
            <div className="form-group">
              <label className="form-label">GitHub Pull Request URL</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://github.com/owner/repo/pull/42"
                value={prUrl}
                onChange={(e) => setPrUrl(e.target.value)}
                required
              />
            </div>
          )}

          {type === "DELIVERY" && (
            <>
              <button type="button" onClick={useMyLocation} className="btn btn-secondary" style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "8px" }}>
                <MapPin size={16} />
                <span>Use My Location</span>
              </button>
              {geoError && <p style={{ color: "var(--error-red)", fontSize: "0.8rem" }}>{geoError}</p>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="form-group">
                  <label className="form-label">Latitude</label>
                  <input type="text" className="form-input" placeholder="6.5244" value={lat} onChange={(e) => setLat(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Longitude</label>
                  <input type="text" className="form-input" placeholder="3.3792" value={lng} onChange={(e) => setLng(e.target.value)} required />
                </div>
              </div>
            </>
          )}

          {requiresFile && (
            <div className="form-group">
              <label className="form-label">
                {type === "RECEIPT" ? "Receipt Photo" : "Delivery Photo"}
              </label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: "none" }} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-secondary"
                style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "8px" }}
              >
                <Upload size={16} />
                <span>{file ? "Change Photo" : "Upload Photo"}</span>
              </button>
              {file && <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "6px" }}>{file.name}</span>}
            </div>
          )}

          {type === "MANUAL" && (
            <div className="form-group">
              <label className="form-label">Attachment Image (Optional)</label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: "none" }} />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="btn btn-secondary" style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "8px" }}>
                <Upload size={16} />
                <span>{file ? "Change Attachment" : "Attach File"}</span>
              </button>
              {file && <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "6px" }}>{file.name}</span>}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              {type === "MANUAL" ? "Claim Description" : "Description"}
            </label>
            <textarea
              className="form-textarea"
              placeholder={
                type === "MANUAL"
                  ? "Describe how you satisfied the custom condition rule."
                  : "e.g. Starbucks coffee — 12.50 cUSD"
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={type === "MANUAL" ? 4 : 2}
              required
            />
          </div>

          {previewUrl && (
            <div className="form-group">
              <label className="form-label">Photo Preview</label>
              <div style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid var(--border-glass)", maxHeight: "240px", display: "flex", justifyContent: "center", background: "rgba(0, 0, 0, 0.2)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Proof preview" style={{ width: "100%", height: "100%", objectFit: "contain", maxHeight: "240px" }} />
              </div>
            </div>
          )}

          {!isConnected && (
            <Notice tone="warn">Connect your wallet to submit a claim.</Notice>
          )}
          {(uploadError || txError) && <Notice tone="error">{uploadError ?? txError}</Notice>}

          <button type="submit" className="btn btn-primary" disabled={!canSubmit} style={{ width: "100%", marginTop: "8px" }}>
            {busy ? (
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <Send size={16} />
            )}
            <span>{submitLabel}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

function Notice({ tone, children }: { tone: "warn" | "error"; children: React.ReactNode }) {
  const color = tone === "error" ? "var(--error-red)" : "var(--primary-gold)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", borderRadius: "10px", fontSize: "0.85rem", color, background: tone === "error" ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)", border: `1px solid ${tone === "error" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)"}` }}>
      <AlertTriangle size={16} style={{ flexShrink: 0 }} />
      <span>{children}</span>
    </div>
  );
}
