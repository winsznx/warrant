import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Warrant — Conditional Payments on Celo",
    short_name: "Warrant",
    description:
      "Lock cUSD. Define a condition. Get paid when you prove it. An autonomous escrow agent on Celo.",
    start_url: "/",
    display: "standalone",
    background_color: "#07090e",
    theme_color: "#07090e",
    icons: [
      { src: "/icon.png", sizes: "any", type: "image/png" },
      { src: "/logo.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
