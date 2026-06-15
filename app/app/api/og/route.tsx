import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const amount = searchParams.get("amount") || "50";
    const type = searchParams.get("type") || "RECEIPT";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#07090e",
            backgroundImage: "radial-gradient(circle at 50% 50%, #1e1b4b 0%, #07090e 100%)",
            padding: "80px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "rgba(17, 22, 34, 0.8)",
              border: "1.5px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "24px",
              padding: "48px 64px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
            }}
          >
            <div
              style={{
                background: "rgba(139, 92, 246, 0.1)",
                border: "1px solid rgba(139, 92, 246, 0.2)",
                color: "#a78bfa",
                padding: "8px 20px",
                borderRadius: "9999px",
                fontSize: "16px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "24px",
              }}
            >
              Warrant Conditional Payment Escrow
            </div>

            <div
              style={{
                fontSize: "72px",
                fontWeight: 800,
                color: "#F59E0B",
                fontFamily: "monospace",
                marginBottom: "16px",
              }}
            >
              {amount} cUSD Locked
            </div>

            <div
              style={{
                fontSize: "24px",
                color: "#94A3B8",
                textAlign: "center",
                maxWidth: "600px",
              }}
            >
              Escrow release is gated by autonomous agent verifying: <strong>{type} Mode</strong>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch {
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
