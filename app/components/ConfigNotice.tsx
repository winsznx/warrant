import { AlertTriangle } from "lucide-react";
import { isContractConfigured, ACTIVE_CHAIN } from "@/lib/config";

/**
 * Renders a clear setup banner when the Warrant contract address is not yet
 * configured in the environment, so the app degrades gracefully instead of
 * silently failing all on-chain reads.
 */
export function ConfigNotice() {
  if (isContractConfigured()) return null;
  return (
    <div
      className="glass-card"
      style={{
        border: "1.5px solid rgba(245, 158, 11, 0.22)",
        display: "flex",
        gap: "16px",
        alignItems: "flex-start",
        padding: "24px",
      }}
    >
      <AlertTriangle size={22} style={{ color: "var(--primary-gold)", flexShrink: 0 }} />
      <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
        <strong style={{ color: "var(--text-primary)" }}>
          Warrant contract not configured.
        </strong>
        <p style={{ marginTop: "6px" }}>
          Deploy <code>WarrantAgent.sol</code> to {ACTIVE_CHAIN.name} and set{" "}
          <code>NEXT_PUBLIC_WARRANT_CONTRACT</code> in your environment to enable
          on-chain reads and writes.
        </p>
      </div>
    </div>
  );
}
