"use client";

import { useMemo } from "react";
import { Shield, Cpu, Layers, ExternalLink, CheckCircle2 } from "lucide-react";
import { useAllWarrants, useAgentOperator, useVerificationFee } from "@/lib/warrants";
import { ConditionIcon } from "@/components/ConditionIcon";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfigNotice } from "@/components/ConfigNotice";
import { formatCusd, truncateAddress } from "@/lib/format";
import {
  ACTIVE_CHAIN,
  SCAN_8004_URL,
  explorerAddress,
  isContractConfigured,
} from "@/lib/config";
import type { Warrant, ConditionTypeName } from "@/lib/types";
import { CONDITION_NAMES } from "@/lib/types";

const CAPABILITIES = ["verify-receipt", "verify-delivery", "verify-milestone", "verify-manual"];

export default function AgentStatusPage() {
  const { warrants } = useAllWarrants({ poll: true });
  const operator = useAgentOperator();
  const fee = useVerificationFee();

  const stats = useMemo(() => {
    let escrowed = 0n;
    let released = 0n;
    let releasedCount = 0;
    const byType: Record<ConditionTypeName, number> = {
      RECEIPT: 0,
      DELIVERY: 0,
      MILESTONE: 0,
      MANUAL: 0,
    };
    for (const w of warrants) {
      byType[w.conditionType] += 1;
      if (w.status === "RELEASED") {
        released += w.amount;
        releasedCount += 1;
      } else if (w.status === "OPEN" || w.status === "CLAIMED") {
        escrowed += w.amount;
      }
    }
    return { escrowed, released, releasedCount, byType, total: warrants.length };
  }, [warrants]);

  const recent = useMemo(
    () => [...warrants].sort((a, b) => Number(b.id - a.id)).slice(0, 8),
    [warrants],
  );

  return (
    <div style={{ padding: "40px 0", display: "flex", flexDirection: "column", gap: "32px" }}>
      <div>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "8px" }}>Agent Node Panel</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
          Monitor the autonomous ERC-8004 agent and its on-chain settlement activity on {ACTIVE_CHAIN.name}.
        </p>
      </div>

      <ConfigNotice />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
        <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
              <Shield size={18} style={{ color: "var(--primary-gold)" }} />
              <span>ERC-8004 Identity</span>
            </h3>
            <a
              href={SCAN_8004_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: "0.75rem", color: "var(--cta-purple)", display: "flex", alignItems: "center", gap: "4px" }}
            >
              8004scan <ExternalLink size={12} />
            </a>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.9rem" }}>
            <Row label="Agent Name" value="WarrantAgent" />
            <Row
              label="Operator Wallet"
              value={
                operator ? (
                  <a href={explorerAddress(operator)} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-primary)" }}>
                    {truncateAddress(operator)}
                  </a>
                ) : (
                  "—"
                )
              }
            />
            <Row label="Network" value={ACTIVE_CHAIN.name} />
            <Row label="Verification Fee" value={`${formatCusd(fee)} cUSD`} last />
          </div>

          <div>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: "8px" }}>
              Capability Claims:
            </span>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {CAPABILITIES.map((cap) => (
                <span
                  key={cap}
                  style={{ fontSize: "0.7rem", background: "rgba(139, 92, 246, 0.08)", border: "1px solid rgba(139, 92, 246, 0.15)", padding: "2px 8px", borderRadius: "6px", fontFamily: "var(--font-mono)", color: "#a78bfa" }}
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
            <Cpu size={18} style={{ color: "var(--cta-purple)" }} />
            <span>On-chain Activity</span>
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.9rem" }}>
            <Row label="Total Warrants" value={<Mono>{stats.total}</Mono>} />
            <Row label="Settlements Released" value={<Mono>{stats.releasedCount}</Mono>} />
            <Row label="Funds Released" value={<Mono style={{ color: "var(--success-green)" }}>{formatCusd(stats.released)} cUSD</Mono>} />
            <Row label="Currently Escrowed" value={<Mono style={{ color: "var(--primary-gold)" }}>{formatCusd(stats.escrowed)} cUSD</Mono>} last />
          </div>

          <div style={{ background: "rgba(139, 92, 246, 0.03)", border: "1px solid var(--border-glass)", borderRadius: "12px", padding: "12px", fontSize: "0.775rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
            <strong>x402:</strong> each verification draws the warrant&apos;s dedicated fee balance
            ({formatCusd(fee)} cUSD), settled on-chain to the operator on release or rejection.
          </div>
        </div>

        <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
            <Layers size={18} style={{ color: "var(--primary-gold)" }} />
            <span>Volume by Engine</span>
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontSize: "0.85rem" }}>
            {CONDITION_NAMES.map((name) => {
              const c = stats.byType[name];
              const pct = stats.total === 0 ? 0 : (c / stats.total) * 100;
              return (
                <div key={name} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                    <span>{name}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-primary)" }}>
                      {c} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "9999px", height: "8px", overflow: "hidden", border: "1px solid var(--border-glass)" }}>
                    <div style={{ background: "linear-gradient(90deg, var(--cta-purple), var(--primary-gold))", width: `${pct}%`, height: "100%", borderRadius: "9999px" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckCircle2 size={20} style={{ color: "var(--primary-gold)" }} />
            <span>Recent Settlements</span>
          </h3>
        </div>

        {recent.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", textAlign: "center", padding: "24px 0" }}>
            {isContractConfigured()
              ? "No warrants yet. Create one to see live activity here."
              : "Configure the contract to view on-chain activity."}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-glass)", color: "var(--text-muted)" }}>
                  <th style={{ padding: "12px" }}>Warrant</th>
                  <th style={{ padding: "12px" }}>Type</th>
                  <th style={{ padding: "12px" }}>Amount</th>
                  <th style={{ padding: "12px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((w: Warrant) => (
                  <tr key={w.id.toString()} style={{ borderBottom: "1px solid var(--border-glass)" }}>
                    <td style={{ padding: "12px" }}>
                      <a href={`/warrant/${w.id}`} style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                        #{w.id.toString()}
                      </a>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <ConditionIcon type={w.conditionType} size={14} />
                        {w.conditionType}
                      </span>
                    </td>
                    <td style={{ padding: "12px", fontFamily: "var(--font-mono)" }}>{w.amountFormatted} cUSD</td>
                    <td style={{ padding: "12px" }}>
                      <StatusBadge status={w.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: last ? "none" : "1px solid var(--border-glass)", paddingBottom: last ? 0 : "8px" }}>
      <span style={{ color: "var(--text-muted)" }}>{label}:</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function Mono({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, ...style }}>{children}</span>;
}
