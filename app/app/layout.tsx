import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import "./globals.css";
import Header from "../components/Header";
import { Providers } from "../components/Providers";
import { wagmiConfig } from "../lib/wagmi";
import {
  GITHUB_URL,
  TWITTER_URL,
  SCAN_8004_AGENT_URL,
  WARRANT_CONTRACT_ADDRESS,
  explorerAddress,
} from "../lib/config";

export const metadata: Metadata = {
  metadataBase: new URL("https://trywarrant.xyz"),
  title: "Warrant — Conditional Payments on Celo",
  description:
    "Lock cUSD in trustless escrow. Release it only when conditions (receipts, deliveries, milestones, manual rules) are verified by an autonomous AI agent.",
  openGraph: {
    title: "Warrant — Conditional Payments on Celo",
    description:
      "Lock cUSD in trustless escrow. Release it only when conditions are verified by an autonomous AI agent.",
    url: "https://trywarrant.xyz",
    siteName: "Warrant",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Warrant — Conditional Payments on Celo",
    description:
      "Lock cUSD in trustless escrow. Release it only when conditions are verified by an autonomous AI agent.",
    site: "@trywarrant",
    creator: "@winsznx",
  },
  other: {
    "talentapp:project_verification":
      "21abdc29fbc592afa058ff26b606ac7d008a6a843f6febcd0c107219ea78dbad030d34eefa9cb362a6598c0247aaff5a3d7360223a10a06e6eb50419865d2591",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#07090e",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialState = cookieToInitialState(
    wagmiConfig,
    (await headers()).get("cookie"),
  );

  return (
    <html lang="en">
      <body>
        <Providers initialState={initialState}>
          <div className="navbar-container">
            <Header />
          </div>

          <main className="page-wrapper container">{children}</main>

          <footer
            style={{
              borderTop: "1px solid var(--border-glass)",
              padding: "40px 0",
              marginTop: "auto",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "0.875rem",
            }}
          >
            <div className="container">
              <div
                style={{
                  display: "flex",
                  gap: "24px",
                  justifyContent: "center",
                  flexWrap: "wrap",
                  marginBottom: "20px",
                }}
              >
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="footer-link">
                  GitHub
                </a>
                <a href={SCAN_8004_AGENT_URL} target="_blank" rel="noopener noreferrer" className="footer-link">
                  ERC-8004 Agent
                </a>
                {WARRANT_CONTRACT_ADDRESS && (
                  <a
                    href={explorerAddress(WARRANT_CONTRACT_ADDRESS)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-link"
                  >
                    Contract
                  </a>
                )}
                <a href={TWITTER_URL} target="_blank" rel="noopener noreferrer" className="footer-link">
                  X
                </a>
              </div>
              <p>© 2026 Warrant Agent. All rights reserved.</p>
              <p style={{ marginTop: "8px", fontSize: "0.775rem" }}>
                Built on Celo for the Onchain Agents Hackathon • ERC-8004 Compliant
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
