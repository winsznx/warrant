import { celo, celoAlfajores } from "viem/chains";
import type { Address } from "viem";

export const CELO_MAINNET_ID = 42220;
export const ALFAJORES_ID = 44787;

function resolveChainId(): typeof CELO_MAINNET_ID | typeof ALFAJORES_ID {
  const raw = process.env.NEXT_PUBLIC_CELO_CHAIN_ID;
  // Default to Celo mainnet; only Alfajores (44787) opts out.
  const parsed = raw ? Number(raw) : CELO_MAINNET_ID;
  return parsed === ALFAJORES_ID ? ALFAJORES_ID : CELO_MAINNET_ID;
}

export const ACTIVE_CHAIN_ID = resolveChainId();
export const ACTIVE_CHAIN = ACTIVE_CHAIN_ID === CELO_MAINNET_ID ? celo : celoAlfajores;
export const IS_MAINNET = ACTIVE_CHAIN_ID === CELO_MAINNET_ID;

/** Canonical cUSD token addresses per Celo network. */
const CUSD_BY_CHAIN: Record<number, Address> = {
  [CELO_MAINNET_ID]: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  [ALFAJORES_ID]: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
};

export const CUSD_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_CUSD_ADDRESS as Address | undefined) ??
  CUSD_BY_CHAIN[ACTIVE_CHAIN_ID];

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const rawContract = process.env.NEXT_PUBLIC_WARRANT_CONTRACT;
export const WARRANT_CONTRACT_ADDRESS: Address | undefined =
  rawContract && ADDRESS_RE.test(rawContract) ? (rawContract as Address) : undefined;

export function isContractConfigured(): boolean {
  return WARRANT_CONTRACT_ADDRESS !== undefined;
}

export const CUSD_DECIMALS = 18;
export const CUSD_SYMBOL = "cUSD";

export const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_ID ?? "";

export const RPC_URL =
  process.env.NEXT_PUBLIC_CELO_RPC_URL ??
  ACTIVE_CHAIN.rpcUrls.default.http[0];

export const EXPLORER_URL =
  ACTIVE_CHAIN.blockExplorers?.default.url ?? "https://celoscan.io";

export const SCAN_8004_URL =
  process.env.NEXT_PUBLIC_8004SCAN_URL ?? "https://8004scan.io";

export function explorerTx(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function explorerAddress(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}

/** ERC-8004 agent identity (env-overridable). */
export const AGENT_ID = process.env.NEXT_PUBLIC_AGENT_ID ?? "9313";

/** 8004scan chain slug for the active network. */
const SCAN_8004_CHAIN = ACTIVE_CHAIN_ID === CELO_MAINNET_ID ? "celo" : "celo-alfajores";

/** Deep link to THIS agent's 8004scan profile (not the generic explorer home). */
export const SCAN_8004_AGENT_URL = `${SCAN_8004_URL}/agents/${SCAN_8004_CHAIN}/${AGENT_ID}`;

/** Project links. */
export const GITHUB_URL =
  process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/winsznx/warrant";
export const TWITTER_URL =
  process.env.NEXT_PUBLIC_TWITTER_URL ?? "https://x.com/trywarrant";
