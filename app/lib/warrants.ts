"use client";

import { useMemo, useState } from "react";
import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useConfig,
} from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { decodeEventLog, keccak256, stringToHex, type Address, type Hex } from "viem";
import { WARRANT_AGENT_ABI, ERC20_ABI } from "./abi";
import {
  WARRANT_CONTRACT_ADDRESS,
  CUSD_ADDRESS,
  ACTIVE_CHAIN_ID,
  isContractConfigured,
} from "./config";
import {
  conditionName,
  statusName,
  ZERO_ADDRESS,
  type OnchainWarrant,
  type Warrant,
} from "./types";
import { formatCusd, readableError } from "./format";
import { feeCurrencyExtras } from "./minipay";

const CONTRACT = WARRANT_CONTRACT_ADDRESS;

const warrantContract = {
  address: CONTRACT,
  abi: WARRANT_AGENT_ABI,
  chainId: ACTIVE_CHAIN_ID,
} as const;

/** Deterministic proof hash committed on-chain alongside the proof URI. */
export function computeProofHash(proofURI: string): Hex {
  return keccak256(stringToHex(proofURI));
}

function toWarrant(id: bigint, raw: OnchainWarrant): Warrant {
  const expiresAtMs = Number(raw.expiresAt) * 1000;
  return {
    id,
    sender: raw.sender,
    receiver: raw.receiver,
    amount: raw.amount,
    amountFormatted: formatCusd(raw.amount),
    conditionType: conditionName(raw.conditionType),
    conditionTypeRaw: raw.conditionType,
    status: statusName(raw.status),
    statusRaw: raw.status,
    ruleURI: raw.ruleURI,
    expiresAt: new Date(expiresAtMs),
    expiresAtMs,
    proofHash: raw.proofHash,
    proofURI: raw.proofURI,
    agentAddress: raw.agentAddress,
    payoutToken: raw.payoutToken,
    isExpired: expiresAtMs <= Date.now(),
    isOpenClaim: raw.receiver === ZERO_ADDRESS,
  };
}

function isRealWarrant(raw: OnchainWarrant): boolean {
  return raw.sender !== ZERO_ADDRESS;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function useWarrant(id?: bigint, opts?: { poll?: boolean }) {
  const enabled = isContractConfigured() && id !== undefined && id > 0n;
  const query = useReadContract({
    ...warrantContract,
    functionName: "getWarrant",
    args: id !== undefined ? [id] : undefined,
    query: {
      enabled,
      refetchInterval: opts?.poll ? 4_000 : false,
    },
  });

  const warrant = useMemo(() => {
    if (!query.data || id === undefined) return undefined;
    const raw = query.data as unknown as OnchainWarrant;
    if (!isRealWarrant(raw)) return undefined;
    return toWarrant(id, raw);
  }, [query.data, id]);

  return {
    warrant,
    notFound: !!query.data && warrant === undefined,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useWarrantCount() {
  const query = useReadContract({
    ...warrantContract,
    functionName: "getWarrantCount",
    query: { enabled: isContractConfigured(), refetchInterval: 15_000 },
  });
  return {
    count: query.data ? Number(query.data) : 0,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useWarrantIds(kind: "sent" | "received", address?: Address) {
  const query = useReadContract({
    ...warrantContract,
    functionName: kind === "sent" ? "getSentWarrants" : "getReceivedWarrants",
    args: address ? [address] : undefined,
    query: {
      enabled: isContractConfigured() && !!address,
      refetchInterval: 12_000,
    },
  });
  const ids = (query.data as readonly bigint[] | undefined) ?? [];
  return { ids: [...ids], isLoading: query.isLoading, refetch: query.refetch };
}

export function useWarrantsByIds(ids: bigint[], opts?: { poll?: boolean }) {
  const key = ids.join(",");
  const contracts = useMemo(
    () =>
      CONTRACT
        ? ids.map((id) => ({
            address: CONTRACT,
            abi: WARRANT_AGENT_ABI,
            functionName: "getWarrant" as const,
            args: [id] as const,
            chainId: ACTIVE_CHAIN_ID,
          }))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  const query = useReadContracts({
    contracts,
    query: {
      enabled: isContractConfigured() && ids.length > 0,
      refetchInterval: opts?.poll ? 8_000 : false,
    },
  });

  const warrants = useMemo(() => {
    if (!query.data) return [] as Warrant[];
    const out: Warrant[] = [];
    query.data.forEach((res, i) => {
      if (res.status !== "success" || !res.result) return;
      const raw = res.result as unknown as OnchainWarrant;
      if (!isRealWarrant(raw)) return;
      out.push(toWarrant(ids[i], raw));
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, key]);

  return { warrants, isLoading: query.isLoading, refetch: query.refetch };
}

export function useVerificationFee() {
  const query = useReadContract({
    ...warrantContract,
    functionName: "verificationFee",
    query: { enabled: isContractConfigured() },
  });
  return (query.data as bigint | undefined) ?? 0n;
}

export function useAgentOperator(): Address | undefined {
  const query = useReadContract({
    ...warrantContract,
    functionName: "agentOperator",
    query: { enabled: isContractConfigured() },
  });
  return query.data as Address | undefined;
}

/** Read every warrant (1..count) for global stats / activity feeds. */
export function useAllWarrants(opts?: { poll?: boolean }) {
  const { count, isLoading: loadingCount } = useWarrantCount();
  const ids = useMemo(
    () => Array.from({ length: count }, (_, i) => BigInt(i + 1)),
    [count],
  );
  const { warrants, isLoading, refetch } = useWarrantsByIds(ids, opts);
  return { warrants, count, isLoading: loadingCount || isLoading, refetch };
}

export function useCusdBalance(address?: Address) {
  const query = useReadContract({
    address: CUSD_ADDRESS,
    abi: ERC20_ABI,
    chainId: ACTIVE_CHAIN_ID,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 12_000 },
  });
  const balance = (query.data as bigint | undefined) ?? 0n;
  return { balance, formatted: formatCusd(balance), isLoading: query.isLoading, refetch: query.refetch };
}

/**
 * Resolve the Mento (exchangeProvider, exchangeId) route for a cUSD→tokenOut
 * payout. Returns null when no route exists (broker unset, pair unsupported),
 * in which case the warrant should pay out in cUSD.
 */
export function useMentoRoute(tokenOut?: Address) {
  const enabled = isContractConfigured() && !!tokenOut;
  const query = useReadContract({
    ...warrantContract,
    functionName: "findMentoRoute",
    args: tokenOut ? [tokenOut] : undefined,
    query: { enabled, retry: false },
  });
  const route =
    query.data && Array.isArray(query.data)
      ? { exchangeProvider: query.data[0] as Address, exchangeId: query.data[1] as Hex }
      : null;
  return { route, isLoading: query.isLoading, isError: query.isError };
}

export function useCusdAllowance(owner?: Address) {
  const query = useReadContract({
    address: CUSD_ADDRESS,
    abi: ERC20_ABI,
    chainId: ACTIVE_CHAIN_ID,
    functionName: "allowance",
    args: owner && CONTRACT ? [owner, CONTRACT] : undefined,
    query: { enabled: !!owner && isContractConfigured() },
  });
  return {
    allowance: (query.data as bigint | undefined) ?? 0n,
    refetch: query.refetch,
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type CreateStep =
  | "idle"
  | "approving"
  | "creating"
  | "confirming"
  | "done"
  | "error";

export interface CreateWarrantParams {
  receiver: Address;
  amount: bigint;
  conditionType: number;
  ruleURI: string;
  expiresAt: bigint;
  verificationFee: bigint;
  currentAllowance: bigint;
  /** Payout token + Mento route. Defaults to cUSD (no swap) when omitted. */
  payout?: { token: Address; exchangeProvider: Address; exchangeId: Hex };
}

const NO_PAYOUT = {
  token: ZERO_ADDRESS,
  exchangeProvider: ZERO_ADDRESS,
  exchangeId: "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex,
} as const;

export function useCreateWarrant() {
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();
  const [step, setStep] = useState<CreateStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<bigint | null>(null);
  const [hash, setHash] = useState<Hex | null>(null);

  async function create(
    params: CreateWarrantParams,
  ): Promise<{ ok: boolean; id: bigint | null }> {
    if (!CONTRACT) {
      setError("Warrant contract is not configured.");
      setStep("error");
      return { ok: false, id: null };
    }
    setError(null);
    setCreatedId(null);
    try {
      const total = params.amount + params.verificationFee;
      if (params.currentAllowance < total) {
        setStep("approving");
        const approveHash = await writeContractAsync({
          address: CUSD_ADDRESS,
          abi: ERC20_ABI,
          chainId: ACTIVE_CHAIN_ID,
          functionName: "approve",
          args: [CONTRACT, total],
          ...feeCurrencyExtras(),
        });
        await waitForTransactionReceipt(config, { hash: approveHash, chainId: ACTIVE_CHAIN_ID });
      }

      setStep("creating");
      const createHash = await writeContractAsync({
        address: CONTRACT,
        abi: WARRANT_AGENT_ABI,
        chainId: ACTIVE_CHAIN_ID,
        functionName: "createWarrant",
        args: [
          params.receiver,
          params.amount,
          params.conditionType,
          params.ruleURI,
          params.expiresAt,
          params.payout ?? NO_PAYOUT,
        ],
        ...feeCurrencyExtras(),
      });
      setHash(createHash);

      setStep("confirming");
      const receipt = await waitForTransactionReceipt(config, {
        hash: createHash,
        chainId: ACTIVE_CHAIN_ID,
      });

      let id: bigint | null = null;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: WARRANT_AGENT_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "WarrantCreated") {
            id = decoded.args.warrantId as bigint;
            break;
          }
        } catch {
          // not our event — skip
        }
      }
      setCreatedId(id);
      setStep("done");
      return { ok: true, id };
    } catch (e) {
      setError(readableError(e));
      setStep("error");
      return { ok: false, id: null };
    }
  }

  function reset() {
    setStep("idle");
    setError(null);
    setCreatedId(null);
    setHash(null);
  }

  return {
    create,
    reset,
    step,
    error,
    createdId,
    hash,
    isBusy: step === "approving" || step === "creating" || step === "confirming",
  };
}

export type TxStep = "idle" | "submitting" | "confirming" | "done" | "error";

function useSingleTx() {
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();
  const [step, setStep] = useState<TxStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Hex | null>(null);

  async function run(
    write: () => Promise<Hex>,
  ): Promise<boolean> {
    if (!CONTRACT) {
      setError("Warrant contract is not configured.");
      setStep("error");
      return false;
    }
    setError(null);
    try {
      setStep("submitting");
      const h = await write();
      setHash(h);
      setStep("confirming");
      await waitForTransactionReceipt(config, { hash: h, chainId: ACTIVE_CHAIN_ID });
      setStep("done");
      return true;
    } catch (e) {
      setError(readableError(e));
      setStep("error");
      return false;
    }
  }

  return {
    run,
    writeContractAsync,
    step,
    error,
    hash,
    reset: () => {
      setStep("idle");
      setError(null);
      setHash(null);
    },
    isBusy: step === "submitting" || step === "confirming",
  };
}

export function useSubmitProof() {
  const tx = useSingleTx();
  function submit(params: { warrantId: bigint; proofHash: Hex; proofURI: string }) {
    return tx.run(() =>
      tx.writeContractAsync({
        address: CONTRACT!,
        abi: WARRANT_AGENT_ABI,
        chainId: ACTIVE_CHAIN_ID,
        functionName: "submitProof",
        args: [params.warrantId, params.proofHash, params.proofURI],
        ...feeCurrencyExtras(),
      }),
    );
  }
  return { submit, step: tx.step, error: tx.error, hash: tx.hash, reset: tx.reset, isBusy: tx.isBusy };
}

export function useRefund() {
  const tx = useSingleTx();
  function refund(warrantId: bigint) {
    return tx.run(() =>
      tx.writeContractAsync({
        address: CONTRACT!,
        abi: WARRANT_AGENT_ABI,
        chainId: ACTIVE_CHAIN_ID,
        functionName: "refund",
        args: [warrantId],
        ...feeCurrencyExtras(),
      }),
    );
  }
  return { refund, step: tx.step, error: tx.error, hash: tx.hash, reset: tx.reset, isBusy: tx.isBusy };
}
