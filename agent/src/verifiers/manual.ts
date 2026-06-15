import { ProofPayload } from "../types.js";
import { llm, TEXT_MODEL, VISION_MODEL } from "../llm.js";

export async function verifyManual(proof: ProofPayload, ruleStr: string): Promise<boolean> {
  console.log(`[Verifier: Manual] Running check. Rule: "${ruleStr}". Proof:`, proof);

  const proofText = proof.description || "";

  if (!proofText && !proof.imageUrl) {
    console.log("[Verifier: Manual] Rejected: No text description or image provided in proof.");
    return false;
  }

  if (!llm) {
    console.log("[Verifier: Manual] HEURISTIC MODE: no LLM key set. Running keyword heuristics.");
    await new Promise((r) => setTimeout(r, 2000));

    const text = proofText.toLowerCase();
    if (text.includes("fail") || text.includes("invalid") || text.includes("reject")) {
      console.log("[Verifier: Manual] Mock rejected: negative keywords found.");
      return false;
    }

    console.log("[Verifier: Manual] Mock approved.");
    return true;
  }

  try {
    const userContent: any[] = [
      {
        type: "text",
        text: `You are a payment conditional verification agent.
        Review the following rule and proof submitted by a claimant, and determine if the proof satisfies the rule.
        
        Rule: "${ruleStr}"
        Claimant Description: "${proofText}"
        
        If the proof satisfies the rule, respond with YES. If not, respond with NO.
        Return only YES or NO.`
      }
    ];

    if (proof.imageUrl) {
      userContent.push({
        type: "image_url",
        image_url: { url: proof.imageUrl }
      });
    }

    const response = await llm.chat.completions.create({
      model: proof.imageUrl ? VISION_MODEL : TEXT_MODEL,
      messages: [
        {
          role: "user",
          content: userContent
        }
      ]
    });

    const answer = response.choices[0].message.content?.trim().toUpperCase();
    console.log("[Verifier: Manual] OpenAI Answer:", answer);
    return answer === "YES";
  } catch (err) {
    console.error("[Verifier: Manual] Error calling OpenAI for manual check:", err);
    return false;
  }
}
