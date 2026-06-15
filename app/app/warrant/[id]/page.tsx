"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount, useWatchContractEvent } from "wagmi";
import {
  Calendar,
  ArrowLeft,
  RefreshCw,
  Layers,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Cpu,
} from "lucide-react";
import { useWarrant, useRefund } from "@/lib/warrants";
import { WARRANT_AGENT_ABI } from "@/lib/abi";
import { WARRANT_CONTRACT_ADDRESS, ACTIVE_CHAIN_ID, isContractConfigured, explorerAddress } from "@/lib/config";
import { ConditionIcon, CONDITION_LABEL } from "@/components/ConditionIcon";
import { StatusBadge } from "@/components/StatusBadge";
import { parseRule, ruleSummary } from "@/lib/rules";
import { resolveIpfsUrl } from "@/lib/ipfs";
import { isCusd, symbolForToken } from "@/lib/mento";
import { truncateAddress, timeLeft } from "@/lib/format";

function parseId(raw: string): bigint | null {
  try {
    const id = BigInt(raw);
    return id > 0n ? id : null;
  } catch {
    return null;
  }
}

export default function WarrantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { address } = useAccount();

  const id = parseId(params.id as string);
  const { warrant, notFound, isLoading, refetch } = useWarrant(id ?? undefined, {
    poll: true,
  });
  const { refund, isBusy: refunding, error: refundError } = useRefund();
  const [rejectReason, setRejectReason] = useState<string | null>(null);

  useWatchContractEvent({
    address: WARRANT_CONTRACT_ADDRESS,
    abi: WARRANT_AGENT_ABI,
    chainId: ACTIVE_CHAIN_ID,
    eventName: "WarrantRejected",
    args: id ? { warrantId: id } : undefined,
    enabled: isContractConfigured() && id !== null,
    onLogs(logs) {
      const last = logs[logs.length - 1];
      const reason = last?.args?.reason;
      if (typeof reason === "string") setRejectReason(reason);
      refetch();
    },
  });

  useWatchContractEvent({
    address: WARRANT_CONTRACT_ADDRESS,
    abi: WARRANT_AGENT_ABI,
    chainId: ACTIVE_CHAIN_ID,
    eventName: "WarrantReleased",
    args: id ? { warrantId: id } : undefined,
    enabled: isContractConfigured() && id !== null,
    onLogs() {
      refetch();
    },
  });

  const isSender = !!address && !!warrant && address.toLowerCase() === warrant.sender.toLowerCase();
  const isReceiver = !!address && !!warrant && address.toLowerCase() === warrant.receiver.toLowerCase();
  const canClaim =
    !!warrant && warrant.status === "OPEN" && !warrant.isExpired && (warrant.isOpenClaim || isReceiver);
  const canRefund =
    !!warrant &&
    (warrant.status === "OPEN" || warrant.status === "CLAIMED") &&
    warrant.isExpired &&
    isSender;

  const parsedProof = useMemo(() => {
    if (!warrant?.proofURI) return null;
    const trimmed = warrant.proofURI.trim();
    if (trimmed.startsWith("{")) {
      try {
        return JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }, [warrant?.proofURI]);

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
        <RefreshCw size={28} style={{ animation: "spin 1s linear infinite", marginBottom: "12px" }} />
        <p>Loading warrant #{id.toString()}…</p>
      </div>
    );
  }

  const rule = parseRule(warrant.conditionType, warrant.ruleURI);

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 0" }}>
      <button
        onClick={() => router.push("/warrants")}
        style={{ display: "flex", alignItems: "center", gap: "8px", background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", marginBottom: "24px" }}
      >
        <ArrowLeft size={16} />
        <span>Dashboard</span>
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "32px" }}>
        <div className="glass-card" style={{ padding: "40px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div className="warrant-type-icon" style={{ width: "56px", height: "56px", borderRadius: "14px" }}>
                <ConditionIcon type={warrant.conditionType} size={24} />
              </div>
              <div>
                <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Warrant #{warrant.id.toString()}</h1>
                <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                  {CONDITION_LABEL[warrant.conditionType]}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "2rem", fontWeight: 800, color: "var(--primary-gold)" }}>
                {warrant.amountFormatted} cUSD
              </div>
              {!isCusd(warrant.payoutToken) && (
                <div style={{ fontSize: "0.8rem", color: "var(--cta-purple)", fontWeight: 600 }}>
                  → pays out in {symbolForToken(warrant.payoutToken)}
                </div>
              )}
              <StatusBadge status={warrant.status} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", borderTop: "1px solid var(--border-glass)", paddingTop: "24px", marginBottom: "32px" }}>
            <Field label="Sender">
              <ExplorerLink address={warrant.sender} />
            </Field>
            <Field label="Receiver">
              {warrant.isOpenClaim ? "Open claim (any verified wallet)" : <ExplorerLink address={warrant.receiver} />}
            </Field>
          </div>

          <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "16px", padding: "24px", border: "1px solid var(--border-glass)", marginBottom: "32px" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Cpu size={18} style={{ color: "var(--primary-gold)" }} />
              <span>Condition Specification</span>
            </h3>
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
              {ruleSummary(warrant.conditionType, warrant.ruleURI)}
            </p>
            {rule.type === "MILESTONE" && rule.rule.owner && (
              <p style={{ marginTop: "8px", fontSize: "0.85rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                {rule.rule.owner}/{rule.rule.repo} @ {rule.rule.branch}
              </p>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-glass)", paddingTop: "24px", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              <Calendar size={16} />
              <span>
                {warrant.isExpired ? "Expired" : `Expires ${warrant.expiresAt.toLocaleDateString()}`}
                {warrant.status === "OPEN" && !warrant.isExpired && ` · ${timeLeft(warrant.expiresAtMs)}`}
              </span>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              {canClaim && (
                <button onClick={() => router.push(`/warrant/${warrant.id}/claim`)} className="btn btn-primary">
                  Submit Claim Proof
                </button>
              )}
              {canRefund && (
                <button onClick={() => refund(warrant.id)} className="btn btn-secondary" disabled={refunding}>
                  {refunding ? "Refunding…" : "Refund Escrow"}
                </button>
              )}
              {warrant.status === "CLAIMED" && (
                <div style={{ color: "var(--cta-purple)", fontSize: "0.9rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
                  <RefreshCw size={16} style={{ animation: "spin 2s linear infinite" }} />
                  <span>Awaiting Agent Decision</span>
                </div>
              )}
            </div>
          </div>
          {refundError && (
            <p style={{ color: "var(--error-red)", fontSize: "0.85rem", marginTop: "12px" }}>{refundError}</p>
          )}
        </div>

        {warrant.status === "RELEASED" && (
          <StatusPanel tone="success" icon={<CheckCircle2 size={20} style={{ color: "var(--success-green)" }} />} title="Released">
            The agent verified the proof and released {warrant.amountFormatted} cUSD to the receiver.
          </StatusPanel>
        )}

        {warrant.status === "CLAIMED" && (
          <StatusPanel tone="info" icon={<RefreshCw size={20} style={{ color: "var(--cta-purple)", animation: "spin 2s linear infinite" }} />} title="Verification in progress">
            The autonomous agent is checking the submitted proof against the rule
            (<em>{ruleSummary(warrant.conditionType, warrant.ruleURI)}</em>). On success the
            escrow auto-releases; otherwise the warrant reopens for resubmission. This page updates live.
          </StatusPanel>
        )}

        {(warrant.status === "CLAIMED" || warrant.status === "RELEASED") && warrant.proofURI && (
          <div className="glass-card" style={{ padding: "32px", border: "1.5px solid rgba(139, 92, 246, 0.22)" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Layers size={18} style={{ color: "var(--cta-purple)" }} />
              <span>Submitted Claim Proof</span>
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px", fontSize: "0.9rem" }}>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Proof Hash: </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", wordBreak: "break-all" }}>{warrant.proofHash}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Proof Reference: </span>
                <a href={resolveIpfsUrl(warrant.proofURI)} target="_blank" rel="noopener noreferrer" style={{ color: "var(--cta-purple)", wordBreak: "break-all", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  {warrant.proofURI}
                  <ExternalLink size={12} />
                </a>
              </div>
              {parsedProof && (
                <div style={{ background: "rgba(0,0,0,0.2)", padding: "16px", borderRadius: "8px", color: "var(--text-muted)" }}>
                  <pre style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", overflowX: "auto", whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(parsedProof, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {rejectReason && warrant.status === "OPEN" && (
          <div className="glass-card" style={{ padding: "24px", border: "1.5px solid rgba(239, 68, 68, 0.22)" }}>
            <h4 style={{ color: "var(--error-red)", fontWeight: 700, marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertTriangle size={16} />
              <span>Last Verification Rejected</span>
            </h4>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Reason: {rejectReason}. You can resubmit a corrected proof.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>{label}:</div>
      <div style={{ fontSize: "0.95rem", wordBreak: "break-all" }}>{children}</div>
    </div>
  );
}

function ExplorerLink({ address }: { address: string }) {
  return (
    <a href={explorerAddress(address)} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-primary)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>{truncateAddress(address, 10, 8)}</span>
      <ExternalLink size={12} style={{ color: "var(--text-muted)" }} />
    </a>
  );
}

function StatusPanel({
  tone,
  icon,
  title,
  children,
}: {
  tone: "success" | "info";
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const border = tone === "success" ? "rgba(16, 185, 129, 0.25)" : "rgba(139, 92, 246, 0.25)";
  return (
    <div className="glass-card" style={{ padding: "28px", border: `1.5px solid ${border}` }}>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
        {icon}
        <span>{title}</span>
      </h3>
      <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>{children}</p>
    </div>
  );
}
