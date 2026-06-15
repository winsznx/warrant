import { createHmac, timingSafeEqual } from "crypto";

export const runtime = "nodejs";

const SIGNATURE_HEADER = "x-hub-signature-256";
const EVENT_HEADER = "x-github-event";

interface GitHubWebhookRepository {
  name: string;
  owner: { login: string };
}

interface GitHubPullRequest {
  number: number;
  merged: boolean;
  merged_at: string | null;
  base: { ref: string };
}

interface PullRequestEventPayload {
  action: string;
  pull_request: GitHubPullRequest;
  repository: GitHubWebhookRepository;
}

function isPullRequestEvent(
  payload: unknown,
): payload is PullRequestEventPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const candidate = payload as Record<string, unknown>;
  return (
    typeof candidate.action === "string" &&
    typeof candidate.pull_request === "object" &&
    candidate.pull_request !== null &&
    typeof candidate.repository === "object" &&
    candidate.repository !== null
  );
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.warn(
      "[webhook] GITHUB_WEBHOOK_SECRET unset — skipping signature verification (dev mode)",
    );
    return true;
  }
  if (!signatureHeader) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  return constantTimeEquals(expected, signatureHeader);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const event = req.headers.get(EVENT_HEADER) ?? "unknown";

  if (!verifySignature(rawBody, req.headers.get(SIGNATURE_HEADER))) {
    return json({ error: "invalid signature" }, 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  if (event === "ping") {
    return json({ ok: true, event, handled: true });
  }

  let handled = false;

  if (event === "pull_request" && isPullRequestEvent(payload)) {
    const { action, pull_request: pr, repository } = payload;
    if (action === "closed" && pr.merged === true) {
      const merged = {
        owner: repository.owner.login,
        repo: repository.name,
        number: pr.number,
        branch: pr.base.ref,
        mergedAt: pr.merged_at,
      };
      console.log(
        `[webhook] PR merged ${merged.owner}/${merged.repo}#${merged.number} ` +
          `branch=${merged.branch} mergedAt=${merged.mergedAt ?? "unknown"}`,
      );
      handled = true;
    }
  }

  return json({ ok: true, event, handled });
}
