import { createConfig, http, cookieStorage, createStorage } from "wagmi";
import { celo, celoAlfajores } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";
import { WALLETCONNECT_PROJECT_ID } from "./config";

const connectors = [
  injected({ shimDisconnect: true }),
  ...(WALLETCONNECT_PROJECT_ID
    ? [
        walletConnect({
          projectId: WALLETCONNECT_PROJECT_ID,
          showQrModal: true,
          metadata: {
            name: "Warrant",
            description: "Conditional payment escrow on Celo.",
            url: "https://trywarrant.xyz",
            icons: ["https://trywarrant.xyz/logo.png"],
          },
        }),
      ]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [celo, celoAlfajores],
  connectors,
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
  transports: {
    [celo.id]: http(process.env.NEXT_PUBLIC_CELO_RPC_URL || undefined),
    [celoAlfajores.id]: http(process.env.NEXT_PUBLIC_ALFAJORES_RPC_URL || undefined),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
