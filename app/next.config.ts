import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep the heavy server-only SocialConnect dependency (native WASM) out of
  // the bundle; it is required at runtime only when phone resolution is used.
  serverExternalPackages: ["@celo/identity", "@selfxyz/core", "thirdweb"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "gateway.pinata.cloud" },
      { protocol: "https", hostname: "*.mypinata.cloud" },
      { protocol: "https", hostname: "ipfs.io" },
    ],
  },
  // Serve the A2A agent card at the spec's well-known discovery path.
  async rewrites() {
    return [{ source: "/.well-known/agent-card.json", destination: "/api/a2a" }];
  },
};

export default nextConfig;
