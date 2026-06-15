import type { Address, Hex } from "viem";

/** Condition engines, ordered to match the on-chain `ConditionType` enum. */
export const ConditionType = {
  RECEIPT: 0,
  DELIVERY: 1,
  MILESTONE: 2,
  MANUAL: 3,
} as const;

export type ConditionTypeName = keyof typeof ConditionType;
export type ConditionTypeValue = (typeof ConditionType)[ConditionTypeName];

export const CONDITION_NAMES: ConditionTypeName[] = [
  "RECEIPT",
  "DELIVERY",
  "MILESTONE",
  "MANUAL",
];

export function conditionName(value: number): ConditionTypeName {
  return CONDITION_NAMES[value] ?? "MANUAL";
}

/** Warrant lifecycle states, ordered to match the on-chain `WarrantStatus` enum. */
export const WarrantStatus = {
  OPEN: 0,
  CLAIMED: 1,
  RELEASED: 2,
  REFUNDED: 3,
} as const;

export type WarrantStatusName = keyof typeof WarrantStatus;

export const STATUS_NAMES: WarrantStatusName[] = [
  "OPEN",
  "CLAIMED",
  "RELEASED",
  "REFUNDED",
];

export function statusName(value: number): WarrantStatusName {
  return STATUS_NAMES[value] ?? "OPEN";
}

/** Raw warrant struct as returned by `getWarrant`. */
export interface OnchainWarrant {
  sender: Address;
  receiver: Address;
  amount: bigint;
  conditionType: number;
  ruleHash: Hex;
  ruleURI: string;
  status: number;
  expiresAt: bigint;
  proofHash: Hex;
  proofURI: string;
  agentAddress: Address;
  payoutToken: Address;
  exchangeProvider: Address;
  exchangeId: Hex;
}

/** UI-friendly warrant derived from {@link OnchainWarrant}. */
export interface Warrant {
  id: bigint;
  sender: Address;
  receiver: Address;
  amount: bigint;
  amountFormatted: string;
  conditionType: ConditionTypeName;
  conditionTypeRaw: number;
  status: WarrantStatusName;
  statusRaw: number;
  ruleURI: string;
  expiresAt: Date;
  expiresAtMs: number;
  proofHash: Hex;
  proofURI: string;
  agentAddress: Address;
  payoutToken: Address;
  isExpired: boolean;
  isOpenClaim: boolean;
}

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
