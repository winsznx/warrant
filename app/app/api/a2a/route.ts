import { createPublicClient, http, formatUnits } from "viem";
import { WARRANT_AGENT_ABI } from "@/lib/abi";
import {
  ACTIVE_CHAIN,
  RPC_URL,
  WARRANT_CONTRACT_ADDRESS,
  CUSD_DECIMALS,
} from "@/lib/config";
import { statusName, conditionName } from "@/lib/types";

export const runtime = "nodejs";

/**
 * A2A (Agent-to-Agent) endpoint for the Warrant agent. Served as the agent's
 * JSON-RPC transport and, via a rewrite, as its `/.well-known/agent-card.json`
 * discovery document. The agent answers questions about its capabilities and
 * looks up any warrant's live on-chain status — a real, callable surface, not a
 * stub.
 */
const AGENT_CARD = {
  protocolVersion: "0.3.0",
  name: "Warrant",
  description:
    "Autonomous conditional-payment escrow agent on Celo. Locks cUSD and releases it on-chain when a real-world condition is verified by AI — receipts and deliveries via vision, GitHub milestones, or manual rules.",
  url: "https://trywarrant.xyz/api/a2a",
  preferredTransport: "JSONRPC",
  version: "1.0.0",
  provider: { organization: "Warrant", url: "https://trywarrant.xyz" },
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
  skills: [
    {
      id: "warrant-status",
      name: "Warrant status lookup",
      description:
        "Look up the live on-chain status, condition, and amount of any warrant by its id.",
      tags: ["escrow", "celo", "status", "onchain"],
      examples: ["status of warrant 1", "is warrant 3 released?"],
    },
    {
      id: "agent-info",
      name: "Agent capabilities",
      description:
        "Explain how Warrant verifies conditions (receipt, delivery, GitHub milestone, manual) and settles cUSD on-chain.",
      tags: ["info", "capabilities"],
      examples: ["what can you do?", "how does verification work?"],
    },
  ],
} as const;

const CAPABILITIES_TEXT =
  "Warrant is an autonomous escrow agent on Celo. Lock cUSD against a condition — a receipt, a delivery, a merged GitHub milestone, or a manual rule — and I verify the proof with AI, then release or refund the funds on-chain. Ask me \"status of warrant <id>\" to check any escrow. More at https://trywarrant.xyz.";

function rpc(id: unknown, payload: Record<string, unknown>): Response {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, ...payload });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(params: any): string {
  const parts = params?.message?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((p: { kind?: string }) => p?.kind === "text")
    .map((p: { text?: string }) => p?.text ?? "")
    .join(" ")
    .trim();
}

async function lookupWarrant(text: string): Promise<string | null> {
  const match = text.match(/\d{1,7}/);
  if (!match || !WARRANT_CONTRACT_ADDRESS) return null;

  const client = createPublicClient({ chain: ACTIVE_CHAIN, transport: http(RPC_URL) });
  const count = (await client.readContract({
    address: WARRANT_CONTRACT_ADDRESS,
    abi: WARRANT_AGENT_ABI,
    functionName: "getWarrantCount",
  })) as bigint;

  const id = BigInt(match[0]);
  if (id >= count) {
    return `Warrant #${id} doesn't exist yet — ${count} warrant(s) have been created.`;
  }

  const w = (await client.readContract({
    address: WARRANT_CONTRACT_ADDRESS,
    abi: WARRANT_AGENT_ABI,
    functionName: "getWarrant",
    args: [id],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;

  return `Warrant #${id}: ${formatUnits(w.amount, CUSD_DECIMALS)} cUSD · condition ${conditionName(
    Number(w.conditionType),
  )} · status ${statusName(Number(w.status))} · sender ${w.sender} → receiver ${w.receiver}.`;
}

export function GET(): Response {
  return Response.json(AGENT_CARD);
}

export async function POST(req: Request): Promise<Response> {
  let body: { id?: unknown; method?: string; params?: unknown };
  try {
    body = await req.json();
  } catch {
    return rpc(null, { error: { code: -32700, message: "Parse error" } });
  }

  const { id = null, method } = body;
  if (method !== "message/send" && method !== "message/stream") {
    return rpc(id, { error: { code: -32601, message: `Method not found: ${method}` } });
  }

  const text = extractText(body.params);
  let reply = CAPABILITIES_TEXT;
  try {
    const found = await lookupWarrant(text);
    if (found) reply = found;
  } catch {
    // Fall back to capabilities text if the on-chain read fails.
  }

  return rpc(id, {
    result: {
      kind: "message",
      role: "agent",
      messageId: crypto.randomUUID(),
      parts: [{ kind: "text", text: reply }],
    },
  });
}
