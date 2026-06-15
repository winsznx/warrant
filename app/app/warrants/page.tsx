"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ArrowUpRight, ArrowDownLeft, Plus, Coins, Wallet, Loader2 } from "lucide-react";
import { useWarrantIds, useWarrantsByIds } from "@/lib/warrants";
import { ConditionIcon } from "@/components/ConditionIcon";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfigNotice } from "@/components/ConfigNotice";
import { truncateAddress, timeLeft } from "@/lib/format";
import type { Warrant, WarrantStatusName } from "@/lib/types";

type Tab = "ALL" | "OPEN" | "CLAIMED" | "RELEASED";
const TABS: Tab[] = ["ALL", "OPEN", "CLAIMED", "RELEASED"];

export default function DashboardPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>("ALL");

  const { ids: sentIds, isLoading: loadingSent } = useWarrantIds("sent", address);
  const { ids: receivedIds, isLoading: loadingReceived } = useWarrantIds("received", address);
  const { warrants: sent } = useWarrantsByIds(sentIds, { poll: true });
  const { warrants: received } = useWarrantsByIds(receivedIds, { poll: true });

  const filter = (list: Warrant[]) =>
    activeTab === "ALL"
      ? list
      : list.filter((w) => w.status === (activeTab as WarrantStatusName));

  return (
    <div style={{ padding: "40px 0", display: "flex", flexDirection: "column", gap: "32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "8px" }}>Warrant Escrows</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
            Monitor, claim, and audit conditional stablecoin settlements.
          </p>
        </div>
        <button
          onClick={() => router.push("/create")}
          className="btn btn-gold"
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <Plus size={16} />
          <span>New Warrant</span>
        </button>
      </div>

      <ConfigNotice />

      {!isConnected ? (
        <EmptyCard
          icon={<Wallet size={32} style={{ color: "var(--border-glass-active)" }} />}
          title="Connect your wallet"
          subtitle="Connect a Celo wallet to see warrants you've sent and received."
        />
      ) : (
        <>
          <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px", alignItems: "center" }}>
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="btn"
                style={{
                  padding: "6px 16px",
                  fontSize: "0.85rem",
                  borderRadius: "9999px",
                  background: activeTab === tab ? "rgba(139, 92, 246, 0.15)" : "transparent",
                  color: activeTab === tab ? "var(--text-primary)" : "var(--text-muted)",
                  border: activeTab === tab ? "1px solid var(--cta-purple)" : "1px solid transparent",
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="warrants-container">
            <WarrantColumn
              title="Escrows Sent"
              icon={<ArrowUpRight size={20} style={{ color: "var(--cta-purple)" }} />}
              warrants={filter(sent)}
              loading={loadingSent}
              counterpartyLabel="To"
              counterparty={(w) => (w.isOpenClaim ? "Open Claim" : truncateAddress(w.receiver))}
              onOpen={(id) => router.push(`/warrant/${id}`)}
            />
            <WarrantColumn
              title="Escrows Received"
              icon={<ArrowDownLeft size={20} style={{ color: "var(--primary-gold)" }} />}
              warrants={filter(received)}
              loading={loadingReceived}
              counterpartyLabel="From"
              counterparty={(w) => truncateAddress(w.sender)}
              onOpen={(id) => router.push(`/warrant/${id}`)}
              iconColor="var(--cta-purple)"
            />
          </div>
        </>
      )}
    </div>
  );
}

function WarrantColumn({
  title,
  icon,
  warrants,
  loading,
  counterpartyLabel,
  counterparty,
  onOpen,
  iconColor = "var(--primary-gold)",
}: {
  title: string;
  icon: React.ReactNode;
  warrants: Warrant[];
  loading: boolean;
  counterpartyLabel: string;
  counterparty: (w: Warrant) => string;
  onOpen: (id: string) => void;
  iconColor?: string;
}) {
  return (
    <div>
      <h2 className="warrant-section-title">
        {icon}
        <span>{title}</span>
        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.03)", padding: "2px 8px", borderRadius: "8px", marginLeft: "auto" }}>
          {warrants.length}
        </span>
      </h2>

      <div className="warrants-grid">
        {loading ? (
          <EmptyCard
            icon={<Loader2 size={28} className="spin" style={{ color: "var(--cta-purple)", animation: "spin 1s linear infinite" }} />}
            title="Loading escrows…"
          />
        ) : warrants.length > 0 ? (
          warrants.map((w) => (
            <div key={w.id.toString()} className="warrant-row" onClick={() => onOpen(w.id.toString())}>
              <div className="warrant-main">
                <div className="warrant-type-icon" style={{ color: iconColor }}>
                  <ConditionIcon type={w.conditionType} />
                </div>
                <div className="warrant-details">
                  <span className="warrant-amount">{w.amountFormatted} cUSD</span>
                  <div className="warrant-meta">
                    <span>
                      {counterpartyLabel}: {counterparty(w)}
                    </span>
                    <span>·</span>
                    <span>{w.conditionType}</span>
                    {w.status === "OPEN" && (
                      <>
                        <span>·</span>
                        <span>{timeLeft(w.expiresAtMs)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="warrant-right">
                <StatusBadge status={w.status} />
              </div>
            </div>
          ))
        ) : (
          <EmptyCard
            icon={<Coins size={32} style={{ color: "var(--border-glass-active)" }} />}
            title="No matching escrows."
          />
        )}
      </div>
    </div>
  );
}

function EmptyCard({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="glass-card" style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 20px" }}>
      <div style={{ margin: "0 auto 12px auto", display: "flex", justifyContent: "center" }}>{icon}</div>
      <p style={{ fontSize: "0.95rem", color: "var(--text-primary)" }}>{title}</p>
      {subtitle && <p style={{ fontSize: "0.85rem", marginTop: "6px" }}>{subtitle}</p>}
    </div>
  );
}
