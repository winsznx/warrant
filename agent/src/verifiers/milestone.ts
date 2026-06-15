import { Octokit } from "octokit";
import { ProofPayload, MilestoneRule } from "../types.js";

const githubToken = process.env.GITHUB_TOKEN;
const octokit = githubToken && githubToken !== "mock" ? new Octokit({ auth: githubToken }) : null;

function extractPRNumber(prUrl: string): number | null {
  // Pattern: https://github.com/owner/repo/pull/num
  const match = prUrl.match(/\/pull\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export async function verifyMilestone(proof: ProofPayload, ruleStr: string): Promise<boolean> {
  console.log(`[Verifier: Milestone] Running check. Rule: "${ruleStr}". Proof:`, proof);

  let rule: MilestoneRule;
  try {
    rule = JSON.parse(ruleStr);
  } catch (e) {
    console.error("[Verifier: Milestone] Failed to parse rule JSON.", e);
    // fallback default rule
    rule = { owner: "winszn", repo: "warrant", branch: "main" };
  }

  if (!proof.prUrl) {
    console.log("[Verifier: Milestone] Rejected: No PR URL provided in proof.");
    return false;
  }

  const prNumber = extractPRNumber(proof.prUrl);
  if (prNumber === null) {
    console.log("[Verifier: Milestone] Rejected: Invalid PR URL format.");
    return false;
  }

  if (!octokit) {
    console.log("[Verifier: Milestone] MOCK MODE: GitHub token not set. Running mock heuristics.");
    await new Promise((r) => setTimeout(r, 2000));
    
    if (proof.prUrl.toLowerCase().includes("fail") || proof.prUrl.toLowerCase().includes("invalid")) {
      return false;
    }
    return true;
  }

  try {
    const { data: pr } = await octokit.rest.pulls.get({
      owner: rule.owner,
      repo: rule.repo,
      pull_number: prNumber,
    });

    console.log(`[Verifier: Milestone] PR Status: Merged = ${pr.merged}, Target Branch = ${pr.base.ref}`);
    return pr.merged === true && pr.base.ref === rule.branch;
  } catch (err) {
    console.error("[Verifier: Milestone] Error fetching PR from GitHub:", err);
    return false;
  }
}
