import type { Abi } from "viem";

/**
 * ABI for the WarrantAgent escrow contract. Kept in sync with
 * `contracts/src/WarrantAgent.sol`. Declared `as const` so viem/wagmi can infer
 * argument and return types at the call site.
 */
export const WARRANT_AGENT_ABI = [
  {
    type: "constructor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_cUSD", type: "address" },
      { name: "_agentRegistry", type: "address" },
      { name: "_agentOperator", type: "address" },
      { name: "_verificationFee", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "createWarrant",
    stateMutability: "nonpayable",
    inputs: [
      { name: "receiver", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "conditionType", type: "uint8" },
      { name: "ruleURI", type: "string" },
      { name: "expiresAt", type: "uint256" },
      {
        name: "payout",
        type: "tuple",
        components: [
          { name: "token", type: "address" },
          { name: "exchangeProvider", type: "address" },
          { name: "exchangeId", type: "bytes32" },
        ],
      },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "findMentoRoute",
    stateMutability: "view",
    inputs: [{ name: "tokenOut", type: "address" }],
    outputs: [
      { name: "exchangeProvider", type: "address" },
      { name: "exchangeId", type: "bytes32" },
    ],
  },
  {
    type: "function",
    name: "submitProof",
    stateMutability: "nonpayable",
    inputs: [
      { name: "warrantId", type: "uint256" },
      { name: "proofHash", type: "bytes32" },
      { name: "proofURI", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "agentRelease",
    stateMutability: "nonpayable",
    inputs: [{ name: "warrantId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "agentReject",
    stateMutability: "nonpayable",
    inputs: [
      { name: "warrantId", type: "uint256" },
      { name: "reason", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "topUpVerificationFee",
    stateMutability: "nonpayable",
    inputs: [
      { name: "warrantId", type: "uint256" },
      { name: "feeAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "refund",
    stateMutability: "nonpayable",
    inputs: [{ name: "warrantId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setAgentOperator",
    stateMutability: "nonpayable",
    inputs: [{ name: "_newOperator", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setVerificationFee",
    stateMutability: "nonpayable",
    inputs: [{ name: "_newFee", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getWarrant",
    stateMutability: "view",
    inputs: [{ name: "warrantId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "sender", type: "address" },
          { name: "receiver", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "conditionType", type: "uint8" },
          { name: "ruleHash", type: "bytes32" },
          { name: "ruleURI", type: "string" },
          { name: "status", type: "uint8" },
          { name: "expiresAt", type: "uint256" },
          { name: "proofHash", type: "bytes32" },
          { name: "proofURI", type: "string" },
          { name: "agentAddress", type: "address" },
          { name: "payoutToken", type: "address" },
          { name: "exchangeProvider", type: "address" },
          { name: "exchangeId", type: "bytes32" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getSentWarrants",
    stateMutability: "view",
    inputs: [{ name: "sender", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "getReceivedWarrants",
    stateMutability: "view",
    inputs: [{ name: "receiver", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "getWarrantCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "warrantFeeBalance",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "agentOperator",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "verificationFee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "cUSD",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "event",
    name: "WarrantCreated",
    inputs: [
      { name: "warrantId", type: "uint256", indexed: true },
      { name: "sender", type: "address", indexed: true },
      { name: "receiver", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "conditionType", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ProofSubmitted",
    inputs: [
      { name: "warrantId", type: "uint256", indexed: true },
      { name: "submitter", type: "address", indexed: true },
      { name: "proofHash", type: "bytes32", indexed: false },
      { name: "proofURI", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "WarrantReleased",
    inputs: [
      { name: "warrantId", type: "uint256", indexed: true },
      { name: "receiver", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "WarrantRejected",
    inputs: [
      { name: "warrantId", type: "uint256", indexed: true },
      { name: "reason", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "WarrantRefunded",
    inputs: [
      { name: "warrantId", type: "uint256", indexed: true },
      { name: "sender", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FeeToppedUp",
    inputs: [
      { name: "warrantId", type: "uint256", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  { type: "error", name: "ZeroAmount", inputs: [] },
  { type: "error", name: "InvalidExpiry", inputs: [] },
  { type: "error", name: "WarrantNotFound", inputs: [] },
  { type: "error", name: "WarrantNotOpen", inputs: [] },
  { type: "error", name: "WarrantExpired", inputs: [] },
  { type: "error", name: "NotReceiver", inputs: [] },
  { type: "error", name: "InvalidProofHash", inputs: [] },
  { type: "error", name: "WarrantNotClaimed", inputs: [] },
  { type: "error", name: "NotAuthorizedAgent", inputs: [] },
  { type: "error", name: "NotSender", inputs: [] },
  { type: "error", name: "NotExpired", inputs: [] },
  { type: "error", name: "AlreadyFinalized", inputs: [] },
  { type: "error", name: "ZeroAddress", inputs: [] },
  { type: "error", name: "NotSelf", inputs: [] },
  { type: "error", name: "RouteNotFound", inputs: [] },
] as const satisfies Abi;

/** Minimal ERC-20 surface used for cUSD approvals, balances and allowances. */
export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const satisfies Abi;
