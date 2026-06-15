"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { parseUnits, isAddress } from "viem";
import {
  Wallet,
  ShieldCheck,
  FileText,
  MapPin,
  GitBranch,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { ConditionType, type ConditionTypeName, ZERO_ADDRESS } from "@/lib/types";
import { encodeRule, ruleSummary } from "@/lib/rules";
import {
  useCreateWarrant,
  useCusdBalance,
  useCusdAllowance,
  useVerificationFee,
  useMentoRoute,
} from "@/lib/warrants";
import { formatCusd, truncateAddress } from "@/lib/format";
import { isContractConfigured, CUSD_ADDRESS } from "@/lib/config";
import { payoutOptions, isCusd, symbolForToken } from "@/lib/mento";
import { resolvePhone, isPhoneNumber } from "@/lib/phoneClient";
import { ConfigNotice } from "@/components/ConfigNotice";
import type { Address } from "viem";

function safeParseUnits(value: string): bigint {
  try {
    if (!value || Number.isNaN(Number(value))) return 0n;
    return parseUnits(value, 18);
  } catch {
    return 0n;
  }
}

export default function CreateWarrantPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  const [step, setStep] = useState(1);

  const [amount, setAmount] = useState("10");
  const [receiver, setReceiver] = useState("");
  const [expiresDays, setExpiresDays] = useState("7");
  const [conditionType, setConditionType] = useState<ConditionTypeName>("RECEIPT");
  const [payoutToken, setPayoutToken] = useState<Address>(CUSD_ADDRESS);

  const [resolvedAddress, setResolvedAddress] = useState<Address | null>(null);
  const [phoneStatus, setPhoneStatus] = useState<
    "idle" | "resolving" | "found" | "notfound" | "unconfigured"
  >("idle");

  const [receiptMaxAmount, setReceiptMaxAmount] = useState("15");
  const [receiptMerchant, setReceiptMerchant] = useState("");
  const [deliveryLat, setDeliveryLat] = useState("6.5244");
  const [deliveryLng, setDeliveryLng] = useState("3.3792");
  const [deliveryRadius, setDeliveryRadius] = useState("100");
  const [milestoneOwner, setMilestoneOwner] = useState("");
  const [milestoneRepo, setMilestoneRepo] = useState("");
  const [milestoneBranch, setMilestoneBranch] = useState("main");
  const [manualRule, setManualRule] = useState("");

  const { create, step: txStep, error, isBusy } = useCreateWarrant();

  const fee = useVerificationFee();
  const { balance } = useCusdBalance(address);
  const { allowance } = useCusdAllowance(address);

  const usingSwap = !isCusd(payoutToken);
  const { route: mentoRoute, isLoading: routeLoading } = useMentoRoute(
    usingSwap ? payoutToken : undefined,
  );
  const routeUnavailable = usingSwap && !routeLoading && !mentoRoute;

  const amountWei = safeParseUnits(amount);
  const totalWei = amountWei + fee;
  const insufficientBalance = isConnected && totalWei > balance;
  const receiverTrimmed = receiver.trim();
  const receiverIsPhone = isPhoneNumber(receiverTrimmed);
  const receiverInvalid =
    receiverTrimmed !== "" && !isAddress(receiverTrimmed) && !receiverIsPhone;

  // Effective on-chain receiver: a literal address, a resolved phone, else open claim.
  const effectiveReceiver: Address = isAddress(receiverTrimmed)
    ? (receiverTrimmed as Address)
    : (resolvedAddress ?? ZERO_ADDRESS);

  async function handleResolvePhone() {
    setPhoneStatus("resolving");
    setResolvedAddress(null);
    const r = await resolvePhone(receiverTrimmed);
    if (!r.configured) setPhoneStatus("unconfigured");
    else if (r.address) {
      setResolvedAddress(r.address as Address);
      setPhoneStatus("found");
    } else setPhoneStatus("notfound");
  }

  function onReceiverChange(value: string) {
    setReceiver(value);
    setResolvedAddress(null);
    setPhoneStatus("idle");
  }

  const handleNext = () => step < 4 && setStep(step + 1);
  const handleBack = () => step > 1 && setStep(step - 1);

  const stepLabel: Record<string, string> = {
    approving: "Approving cUSD…",
    creating: "Locking funds…",
    confirming: "Confirming…",
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isConnected || !address) return;
    if (amountWei <= 0n || receiverInvalid || insufficientBalance) return;

    const ruleURI = encodeRule(conditionType, {
      receiptMaxAmount,
      receiptMerchant,
      deliveryLat,
      deliveryLng,
      deliveryRadius,
      milestoneOwner,
      milestoneRepo,
      milestoneBranch,
      manualRule,
    });

    const expiresAt = BigInt(
      Math.floor(Date.now() / 1000) + Number(expiresDays) * 86_400,
    );

    const res = await create({
      receiver: effectiveReceiver,
      amount: amountWei,
      conditionType: ConditionType[conditionType],
      ruleURI,
      expiresAt,
      verificationFee: fee,
      currentAllowance: allowance,
      payout:
        usingSwap && mentoRoute
          ? {
              token: payoutToken,
              exchangeProvider: mentoRoute.exchangeProvider,
              exchangeId: mentoRoute.exchangeId,
            }
          : undefined,
    });

    // Only navigate on success — on error (e.g. user rejected the tx) stay so
    // the error banner is visible.
    if (res.ok) {
      router.push(res.id ? `/warrant/${res.id.toString()}` : "/warrants");
    }
  }

  const conditionOptions: {
    type: ConditionTypeName;
    icon: typeof FileText;
    title: string;
    desc: string;
  }[] = [
    { type: "RECEIPT", icon: FileText, title: "Receipt", desc: "Expense verification using OpenAI Vision" },
    { type: "DELIVERY", icon: MapPin, title: "Delivery", desc: "Geofenced location checks & verification" },
    { type: "MILESTONE", icon: GitBranch, title: "Milestone", desc: "Auto-releases when a GitHub PR merges" },
    { type: "MANUAL", icon: ShieldCheck, title: "Manual Rule", desc: "Custom English descriptions judged by AI" },
  ];

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto", padding: "40px 0" }}>
      <div style={{ marginBottom: "24px" }}>
        <ConfigNotice />
      </div>

      <div className="steps-wrapper">
        {["Escrow Details", "Condition Mode", "Define Rule", "Confirm"].map((label, i) => {
          const n = i + 1;
          return (
            <div
              key={label}
              className={`step-node ${step === n ? "active" : ""} ${step > n ? "completed" : ""}`}
            >
              <div className="step-circle">{n}</div>
              <div className="step-label">{label}</div>
            </div>
          );
        })}
      </div>

      <div className="glass-card" style={{ padding: "40px" }}>
        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "8px" }}>
                Configure Escrow Lock
              </h2>

              <div className="form-group">
                <label className="form-label">Amount (cUSD)</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="form-input"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    style={{ paddingLeft: "44px", fontFamily: "var(--font-mono)", fontWeight: 700 }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      left: "18px",
                      top: "15px",
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 700,
                    }}
                  >
                    $
                  </span>
                </div>
                {isConnected && (
                  <span style={{ fontSize: "0.775rem", color: "var(--text-muted)" }}>
                    Balance: {formatCusd(balance)} cUSD
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Receiver Wallet or Phone</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="0x… , +234… phone, or leave empty"
                    value={receiver}
                    onChange={(e) => onReceiverChange(e.target.value)}
                    style={receiverInvalid ? { borderColor: "var(--error-red)" } : undefined}
                  />
                  {receiverIsPhone && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleResolvePhone}
                      disabled={phoneStatus === "resolving"}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      {phoneStatus === "resolving" ? "Looking up…" : "Resolve"}
                    </button>
                  )}
                </div>
                <span
                  style={{
                    fontSize: "0.775rem",
                    color:
                      receiverInvalid || phoneStatus === "notfound"
                        ? "var(--error-red)"
                        : phoneStatus === "found"
                          ? "var(--success-green)"
                          : "var(--text-muted)",
                  }}
                >
                  {receiverInvalid
                    ? "Enter a valid 0x address, a +E.164 phone, or leave empty."
                    : phoneStatus === "found" && resolvedAddress
                      ? `Resolved to ${truncateAddress(resolvedAddress)} via SocialConnect.`
                      : phoneStatus === "notfound"
                        ? "No wallet found for this number — it will become an open claim."
                        : phoneStatus === "unconfigured"
                          ? "Phone lookup isn't enabled here — paste a 0x address or leave empty."
                          : receiverIsPhone
                            ? "Tap Resolve to look up this phone's wallet via SocialConnect (ODIS)."
                            : "Address or +E.164 phone. If empty, the first verified claimant receives the funds."}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Warrant Lock Expiration (Days)</label>
                <select
                  className="form-select"
                  value={expiresDays}
                  onChange={(e) => setExpiresDays(e.target.value)}
                >
                  {["1", "3", "7", "14", "30"].map((d) => (
                    <option key={d} value={d}>
                      {d} {d === "1" ? "Day" : "Days"}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: "0.775rem", color: "var(--text-muted)" }}>
                  The sender can claim a full refund if no verified proof is submitted before expiry.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Receiver Receives</label>
                <select
                  className="form-select"
                  value={payoutToken}
                  onChange={(e) => setPayoutToken(e.target.value as Address)}
                >
                  {payoutOptions().map((opt) => (
                    <option key={opt.address} value={opt.address}>
                      {opt.symbol} — {opt.label}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: "0.775rem", color: routeUnavailable ? "var(--error-red)" : "var(--text-muted)" }}>
                  {isCusd(payoutToken)
                    ? "You lock cUSD; the receiver is paid in cUSD."
                    : routeLoading
                      ? "Checking Mento liquidity…"
                      : routeUnavailable
                        ? `No Mento route for ${symbolForToken(payoutToken)} on this network — choose cUSD or another currency.`
                        : `You lock cUSD; on release it's swapped to ${symbolForToken(payoutToken)} via Mento and sent to the receiver.`}
                </span>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "8px" }}>
                Select Condition Mode
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "24px" }}>
                Choose the rule engine the agent will run to verify proof submissions.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {conditionOptions.map(({ type, icon: Icon, title, desc }) => (
                  <div
                    key={type}
                    className="glass-card"
                    onClick={() => setConditionType(type)}
                    style={{
                      cursor: "pointer",
                      padding: "20px",
                      textAlign: "center",
                      borderColor: conditionType === type ? "var(--cta-purple)" : "var(--border-glass)",
                      background: conditionType === type ? "rgba(139, 92, 246, 0.05)" : "var(--surface-glass)",
                    }}
                  >
                    <Icon size={28} style={{ color: "var(--primary-gold)", margin: "0 auto 12px auto" }} />
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "8px" }}>{title}</h3>
                    <p style={{ fontSize: "0.775rem", color: "var(--text-muted)" }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "8px" }}>
                Define Verification Rule
              </h2>

              {conditionType === "RECEIPT" && (
                <>
                  <div className="form-group">
                    <label className="form-label">Max Allowed Amount (cUSD Equivalent)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={receiptMaxAmount}
                      onChange={(e) => setReceiptMaxAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Required Merchant (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Starbucks, Amazon"
                      value={receiptMerchant}
                      onChange={(e) => setReceiptMerchant(e.target.value)}
                    />
                  </div>
                </>
              )}

              {conditionType === "DELIVERY" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div className="form-group">
                      <label className="form-label">Target Latitude</label>
                      <input type="text" className="form-input" value={deliveryLat} onChange={(e) => setDeliveryLat(e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Target Longitude</label>
                      <input type="text" className="form-input" value={deliveryLng} onChange={(e) => setDeliveryLng(e.target.value)} required />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Acceptable Radius (Meters)</label>
                    <input type="number" className="form-input" value={deliveryRadius} onChange={(e) => setDeliveryRadius(e.target.value)} required />
                  </div>
                </>
              )}

              {conditionType === "MILESTONE" && (
                <>
                  <div className="form-group">
                    <label className="form-label">GitHub Repository Owner</label>
                    <input type="text" className="form-input" placeholder="e.g. winszn" value={milestoneOwner} onChange={(e) => setMilestoneOwner(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Repository Name</label>
                    <input type="text" className="form-input" placeholder="e.g. warrant-core" value={milestoneRepo} onChange={(e) => setMilestoneRepo(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Target Branch</label>
                    <input type="text" className="form-input" value={milestoneBranch} onChange={(e) => setMilestoneBranch(e.target.value)} required />
                  </div>
                </>
              )}

              {conditionType === "MANUAL" && (
                <div className="form-group">
                  <label className="form-label">Plain English Condition Rule</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Describe exactly what proof must show. E.g. 'Receiver must upload a certificate of completion for the React course containing the name Alice Smith.'"
                    value={manualRule}
                    onChange={(e) => setManualRule(e.target.value)}
                    rows={4}
                    required
                  />
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "8px" }}>Review Escrow</h2>

              <div
                className="glass-card"
                style={{ background: "rgba(255, 255, 255, 0.02)", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}
              >
                <ReviewRow label="Locked Amount">
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--primary-gold)" }}>
                    {amount || "0"} cUSD
                  </span>
                </ReviewRow>
                <ReviewRow label="Verification Fee">
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--cta-purple)" }}>
                    {formatCusd(fee)} cUSD
                  </span>
                </ReviewRow>
                <ReviewRow label="Receiver">
                  <span style={{ fontSize: "0.9rem" }}>
                    {isAddress(receiverTrimmed)
                      ? truncateAddress(receiverTrimmed)
                      : resolvedAddress
                        ? `${receiverTrimmed} → ${truncateAddress(resolvedAddress)}`
                        : "Open claim (any verified wallet)"}
                  </span>
                </ReviewRow>
                <ReviewRow label="Receiver Gets">
                  <span style={{ fontSize: "0.9rem" }}>
                    {isCusd(payoutToken)
                      ? "cUSD"
                      : `${symbolForToken(payoutToken)} (swapped via Mento)`}
                  </span>
                </ReviewRow>
                <ReviewRow label="Condition Mode">
                  <span className="badge badge-open">{conditionType}</span>
                </ReviewRow>
                <div>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.9rem", display: "block", marginBottom: "8px" }}>
                    Rule details:
                  </span>
                  <div style={{ background: "rgba(0,0,0,0.3)", padding: "12px 16px", borderRadius: "8px", fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                    {ruleSummary(
                      conditionType,
                      encodeRule(conditionType, {
                        receiptMaxAmount,
                        receiptMerchant,
                        deliveryLat,
                        deliveryLng,
                        deliveryRadius,
                        milestoneOwner,
                        milestoneRepo,
                        milestoneBranch,
                        manualRule,
                      }),
                    )}
                  </div>
                </div>
              </div>

              <div
                className="glass-card"
                style={{ background: "rgba(139, 92, 246, 0.05)", borderColor: "rgba(139, 92, 246, 0.2)", padding: "16px 20px", fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", gap: "12px", alignItems: "center" }}
              >
                <Wallet size={20} style={{ color: "var(--cta-purple)", flexShrink: 0 }} />
                <span>
                  Locking <strong>{formatCusd(totalWei)} cUSD</strong> ({amount || "0"} escrow +{" "}
                  {formatCusd(fee)} fee). You will approve cUSD spending and confirm the lock in your wallet.
                </span>
              </div>

              {!isContractConfigured() && (
                <Banner tone="error">Warrant contract is not configured for this network.</Banner>
              )}
              {!isConnected && (
                <Banner tone="warn">Connect your wallet to lock funds.</Banner>
              )}
              {insufficientBalance && (
                <Banner tone="error">
                  Insufficient balance — you need {formatCusd(totalWei)} cUSD.
                </Banner>
              )}
              {error && <Banner tone="error">{error}</Banner>}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "40px",
              borderTop: "1px solid var(--border-glass)",
              paddingTop: "24px",
            }}
          >
            {step > 1 ? (
              <button type="button" onClick={handleBack} className="btn btn-secondary" disabled={isBusy} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="btn btn-primary"
                disabled={step === 1 && (amountWei <= 0n || receiverInvalid || routeUnavailable)}
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span>Continue</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-gold"
                disabled={!isContractConfigured() || !isConnected || isBusy || insufficientBalance || amountWei <= 0n || routeUnavailable}
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                {isBusy ? (
                  <>
                    <Loader2 size={16} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                    <span>{stepLabel[txStep] ?? "Processing…"}</span>
                  </>
                ) : (
                  <>
                    <span>Initiate Escrow</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function ReviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
      <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>{label}:</span>
      {children}
    </div>
  );
}

function Banner({ tone, children }: { tone: "error" | "warn"; children: React.ReactNode }) {
  const color = tone === "error" ? "var(--error-red)" : "var(--primary-gold)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px 16px",
        borderRadius: "10px",
        fontSize: "0.85rem",
        color,
        background: tone === "error" ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
        border: `1px solid ${tone === "error" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)"}`,
      }}
    >
      <AlertTriangle size={16} style={{ flexShrink: 0 }} />
      <span>{children}</span>
    </div>
  );
}
