"use client";

import Link from "next/link";
import { ArrowRight, Shield, Award, Cpu, Zap, DollarSign } from "lucide-react";
import { useAllWarrants } from "@/lib/warrants";
import { formatCusd } from "@/lib/format";

export default function LandingPage() {
  const { warrants, count } = useAllWarrants();
  const totalLocked = warrants.reduce((acc, w) => acc + w.amount, 0n);
  const releasedCount = warrants.filter((w) => w.status === "RELEASED").length;

  return (
    <div className="landing-container">
      {/* Hero Section */}
      <section className="hero-card">
        <div className="hero-glow-1"></div>
        <div className="hero-glow-2"></div>
        <div className="hero-content">
          <div className="hero-tag">
            <Zap size={14} />
            <span>Conditional Settlement on Celo</span>
          </div>
          
          <h1 className="hero-title">
            Trustless Payments Guaranteed by <span>Autonomous AI Agents</span>
          </h1>
          
          <p className="hero-subtitle">
            Warrant holds cUSD in secure escrows and releases it only when real-world conditions are verified by AI, webhooks, or geographic proofs.
          </p>

          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center" }}>
            <Link href="/create" className="btn btn-primary">
              <span>Create a Warrant</span>
              <ArrowRight size={16} />
            </Link>
            <Link href="/warrants" className="btn btn-secondary">
              <span>Open Dashboard</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-panel">
        <div className="stat-item">
          <div className="stat-number gold">
            {formatCusd(totalLocked)}
          </div>
          <div className="stat-label">
            Total cUSD Locked
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-number purple">
            {count}
          </div>
          <div className="stat-label">
            Warrants Created
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-number green">
            {releasedCount}
          </div>
          <div className="stat-label">
            Settlements Released
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-number white">
            4
          </div>
          <div className="stat-label">
            Condition Engines
          </div>
        </div>
      </section>

      {/* 4 Condition Modes Bento Grid */}
      <section>
        <div className="section-header">
          <h2 className="section-title">Four Verification Engines</h2>
          <p className="section-subtitle">
            One agent, four condition modes. Every payment release is checked, audited, and logged securely onchain.
          </p>
        </div>

        <div className="bento-grid-custom">
          {/* Card 1: Receipt Verification (2 cols) */}
          <div className="bento-card-custom bento-col-2">
            <div style={{ display: "flex", flexDirection: "row", gap: "32px", alignItems: "center", flexWrap: "wrap", width: "100%" }}>
              <div style={{ flex: 1, minWidth: "250px" }}>
                <div className="feature-icon-wrapper">
                  <DollarSign size={24} />
                </div>
                <h3 className="feature-title">Receipt Verification</h3>
                <p className="feature-desc">
                  Claimants upload receipt photos. OpenAI Vision OCR extracts the merchant name, total, and date, comparing them automatically against the rule description.
                </p>
              </div>
              <div style={{ flex: 1, minWidth: "220px", display: "flex", justifyContent: "center" }}>
                <div className="widget-receipt-container">
                  <div className="widget-receipt-scanner"></div>
                  <div className="widget-receipt-paper">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 800 }}>RECEIPT</span>
                      <span>#8201</span>
                    </div>
                    <div className="widget-receipt-line"></div>
                    <div className="widget-receipt-line"></div>
                    <div className="widget-receipt-line short"></div>
                    <div className="widget-receipt-line"></div>
                    <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: "4px", marginTop: "auto", display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
                      <span>TOTAL:</span>
                      <span>$482.00</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Delivery Geofencing (1 col) */}
          <div className="bento-card-custom bento-col-1">
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div className="feature-icon-wrapper">
                  <Shield size={24} />
                </div>
                <h3 className="feature-title">Delivery Geofencing</h3>
                <p className="feature-desc">
                  P2P Escrow verification. The seller uploads a geo-tagged image from the site. The agent runs distance check against target coordinates.
                </p>
              </div>
              <div className="widget-radar-container">
                <div className="widget-radar-center"></div>
                <div className="widget-radar-ring"></div>
                <div className="widget-radar-ring"></div>
                <div className="widget-radar-ring"></div>
                <div className="widget-radar-coordinates">LAT: -1.2921 / LNG: 36.8219</div>
              </div>
            </div>
          </div>

          {/* Card 3: Milestone Hook (1 col) */}
          <div className="bento-card-custom bento-col-1">
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div className="feature-icon-wrapper">
                  <Cpu size={24} />
                </div>
                <h3 className="feature-title">Milestone Hook</h3>
                <p className="feature-desc">
                  For freelancers and dev payouts. The agent polls the GitHub API to check if a specific pull request has been merged to your repo.
                </p>
              </div>
              <div className="widget-git-container">
                <div className="widget-git-pr">
                  <span className="widget-git-branch">#42 merge_hooks</span>
                  <span className="widget-git-badge">Merged</span>
                </div>
                <div className="widget-git-commit-line">
                  <div className="widget-git-node"></div>
                  <div style={{ color: "var(--text-muted)", fontSize: "9px" }}>Add ERC-8004 schemas</div>
                </div>
                <div className="widget-git-commit-line">
                  <div className="widget-git-node end"></div>
                  <div style={{ color: "var(--text-muted)", fontSize: "9px" }}>Attest milestone verified</div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Manual Custom Rules (2 cols) */}
          <div className="bento-card-custom bento-col-2">
            <div style={{ display: "flex", flexDirection: "row", gap: "32px", alignItems: "center", flexWrap: "wrap", width: "100%" }}>
              <div style={{ flex: 1, minWidth: "250px" }}>
                <div className="feature-icon-wrapper">
                  <Award size={24} />
                </div>
                <h3 className="feature-title">Manual Custom Rules</h3>
                <p className="feature-desc">
                  Flexible custom payouts. Senders specify any condition in plain English. The agent acts as an autonomous arbitrator to verify proof claims and metadata.
                </p>
              </div>
              <div style={{ flex: 1, minWidth: "220px" }}>
                <div className="widget-arbitrator-container">
                  <div className="widget-arbitrator-header">
                    <span>agent_daemon_v1.0</span>
                    <span style={{ color: "var(--success-green)" }}>● ONLINE</span>
                  </div>
                  <div>&gt; Loading claim verification...</div>
                  <div>&gt; Evaluating custom rule criteria...</div>
                  <div style={{ color: "var(--primary-gold)" }}>&gt; MATCH CONFIDENCE: 98.4%</div>
                  <div style={{ color: "#34d399" }}>&gt; Attesting ERC-8004... SUCCESS<span className="widget-arbitrator-cursor"></span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Architecture */}
      <section className="trust-section">
        <div style={{ textAlign: "left" }}>
          <h2 className="section-title">ERC-8004 Verification Identity</h2>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "24px" }}>
            Payments are secured by decentralized agent wallets. Every decision is attested onchain, generating public metadata on the ERC-8004 reputation registry.
          </p>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "14px" }}>
            <li style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--primary-gold)", boxShadow: "0 0 8px var(--primary-gold)" }}></div>
              <span>No savings trust problem — secure smart contracts hold escrow.</span>
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--primary-gold)", boxShadow: "0 0 8px var(--primary-gold)" }}></div>
              <span>x402 Micro-payments protect verification calls from sybil spam.</span>
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--primary-gold)", boxShadow: "0 0 8px var(--primary-gold)" }}></div>
              <span>Attested records viewable on 8004scan ranking dashboard.</span>
            </li>
          </ul>
          <Link href="/agent" className="btn btn-secondary" style={{ marginTop: "32px" }}>
            <span>Meet the Agent</span>
          </Link>
        </div>

        <div className="workflow-card">
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--cta-purple)", borderBottom: "1px solid var(--border-glass)", paddingBottom: "16px", letterSpacing: "0.05em" }}>
            {"// WARRANT ESCROW WORKFLOW"}
          </div>
          <div className="workflow-step">
            <div className="step-number-circle">
              1
            </div>
            <div className="workflow-info">
              <h4 className="workflow-title">Sender locks cUSD</h4>
              <p className="workflow-desc">Sender creates a warrant specifying a condition rule, receiver, amount, and expiry time.</p>
            </div>
          </div>
          <div className="workflow-step">
            <div className="step-number-circle">
              2
            </div>
            <div className="workflow-info">
              <h4 className="workflow-title">Receiver submits proof</h4>
              <p className="workflow-desc">The receiver claims the escrow by uploading matching files, GPS data, or a PR URL.</p>
            </div>
          </div>
          <div className="workflow-step">
            <div className="step-number-circle">
              3
            </div>
            <div className="workflow-info">
              <h4 className="workflow-title">Agent releases payment</h4>
              <p className="workflow-desc">The autonomous agent validates the claim. If positive, the cUSD is auto-released to the receiver.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
