import { ImageResponse } from "next/og";

// Next.js file-convention OG image. Renders at the universal 1200×630 (1.91:1)
// so it previews correctly on X, Telegram, Discord, Slack, WhatsApp, iMessage,
// LinkedIn and Facebook. Next auto-emits og:image + twitter:image with the
// absolute URL (via metadataBase), width/height and content-type.
export const alt = "Warrant — Conditional payments on Celo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

const MODES = ["Receipt", "Delivery", "Milestone", "Manual"];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 72px",
          backgroundColor: "#07090e",
          backgroundImage:
            "linear-gradient(135deg, rgba(139,92,246,0.18), rgba(7,9,14,0) 42%), linear-gradient(315deg, rgba(245,158,11,0.14), rgba(7,9,14,0) 42%)",
          color: "#F8FAFC",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top row: wordmark + tag */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 16,
                border: "2px solid #F59E0B",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#F59E0B",
                fontSize: 36,
                fontWeight: 800,
              }}
            >
              W
            </div>
            <span style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1 }}>Warrant</span>
          </div>
          <div
            style={{
              display: "flex",
              padding: "12px 24px",
              borderRadius: 9999,
              backgroundColor: "rgba(139,92,246,0.14)",
              border: "1px solid rgba(139,92,246,0.32)",
              color: "#a78bfa",
              fontSize: 24,
              fontWeight: 600,
            }}
          >
            🟡 Conditional Payments on Celo
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 70, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
            Lock cUSD. Define a condition.
          </div>
          <div
            style={{
              fontSize: 70,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: -2,
              color: "#F59E0B",
            }}
          >
            Get paid when you prove it.
          </div>
          <div style={{ fontSize: 28, color: "#94A3B8", marginTop: 22, maxWidth: 940 }}>
            An autonomous escrow agent that releases stablecoins onchain when a real-world
            condition is verified by AI.
          </div>
        </div>

        {/* Mode chips + footer */}
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div style={{ display: "flex", gap: 14 }}>
            {MODES.map((mode) => (
              <div
                key={mode}
                style={{
                  display: "flex",
                  padding: "12px 22px",
                  borderRadius: 12,
                  backgroundColor: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontSize: 25,
                  fontWeight: 600,
                }}
              >
                {mode}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#6b7280", fontSize: 24 }}>ERC-8004 · x402 · MiniPay · Mento</span>
            <span style={{ color: "#F59E0B", fontSize: 24, fontWeight: 700 }}>trywarrant.xyz</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
