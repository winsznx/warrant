import type { Address } from "viem";
import { CELO_MAINNET_ID, ALFAJORES_ID, ACTIVE_CHAIN_ID, CUSD_ADDRESS } from "./config";

export interface MentoStable {
  symbol: string;
  label: string;
  address: Address;
}

/**
 * Mento local stablecoins available as warrant payout currencies, per network.
 * Addresses verified from the Mento deployment broadcasts. cUSD is the base
 * settlement asset and is always the default (no swap).
 */
const STABLES_BY_CHAIN: Record<number, MentoStable[]> = {
  [CELO_MAINNET_ID]: [
    { symbol: "cKES", label: "Kenyan Shilling", address: "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0" },
    { symbol: "cNGN", label: "Nigerian Naira", address: "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71" },
    { symbol: "cGHS", label: "Ghanaian Cedi", address: "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313" },
    { symbol: "cEUR", label: "Euro", address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73" },
    { symbol: "cREAL", label: "Brazilian Real", address: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787" },
    { symbol: "eXOF", label: "CFA Franc", address: "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08" },
    { symbol: "cCOP", label: "Colombian Peso", address: "0x8A567e2aE79CA692Bd748aB832081C45de4041eA" },
    { symbol: "PUSO", label: "Philippine Peso", address: "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B" },
  ],
  [ALFAJORES_ID]: [
    { symbol: "cKES", label: "Kenyan Shilling", address: "0x1E0433C1769271ECcF4CFF9FDdD515eefE6CdF92" },
    { symbol: "cNGN", label: "Nigerian Naira", address: "0x4a5b03b8b16122d330306c65e4ca4bc5dd6511d0" },
    { symbol: "cGHS", label: "Ghanaian Cedi", address: "0x295b66be7714458af45e6a6ea142a5358a6ca375" },
    { symbol: "eXOF", label: "CFA Franc", address: "0xB0FA15e002516d0301884059c0aaC0F0C72b019D" },
    { symbol: "cCOP", label: "Colombian Peso", address: "0xe6A57340f0df6E020c1c0a80bC6E13048601f0d4" },
    { symbol: "PUSO", label: "Philippine Peso", address: "0x5E0E3c9419C42a1B04e2525991FB1A2C467AB8bF" },
  ],
};

export const CUSD_OPTION: MentoStable = {
  symbol: "cUSD",
  label: "Celo Dollar",
  address: CUSD_ADDRESS,
};

/** Payout options for the active chain: cUSD first, then local stables. */
export function payoutOptions(): MentoStable[] {
  return [CUSD_OPTION, ...(STABLES_BY_CHAIN[ACTIVE_CHAIN_ID] ?? [])];
}

export function isCusd(address: Address): boolean {
  return address.toLowerCase() === CUSD_ADDRESS.toLowerCase();
}

export function symbolForToken(address: Address): string {
  const match = payoutOptions().find(
    (o) => o.address.toLowerCase() === address.toLowerCase(),
  );
  return match?.symbol ?? "cUSD";
}
