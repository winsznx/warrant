import { ProofPayload, ReceiptRule } from "../types.js";
import { llm, VISION_MODEL } from "../llm.js";

export async function verifyReceipt(proof: ProofPayload, ruleStr: string): Promise<boolean> {
  console.log(`[Verifier: Receipt] Running check. Rule: "${ruleStr}". Proof:`, proof);

  // Parse rule
  let rule: ReceiptRule;
  try {
    rule = JSON.parse(ruleStr);
  } catch (e) {
    console.error("[Verifier: Receipt] Failed to parse rule JSON. Assuming manual format.", e);
    // fallback if user input was plain text
    rule = { maxAmount: 100, merchant: ruleStr };
  }

  if (!proof.imageUrl) {
    console.log("[Verifier: Receipt] Rejected: No image URL provided in proof.");
    return false;
  }

  // If no LLM is configured, fall back to heuristic mode
  if (!llm) {
    console.log("[Verifier: Receipt] HEURISTIC MODE: no LLM key set. Running keyword heuristics.");
    
    // Simulating delay
    await new Promise((r) => setTimeout(r, 2000));

    // Heuristic: If it has an image URL, we assume it's mock-valid unless it has "invalid" in the URL or description
    const desc = (proof.description || "").toLowerCase();
    const url = (proof.imageUrl || "").toLowerCase();
    if (desc.includes("invalid") || url.includes("invalid")) {
      console.log("[Verifier: Receipt] Mock rejected: 'invalid' keyword detected.");
      return false;
    }
    
    console.log("[Verifier: Receipt] Mock approved.");
    return true;
  }

  // Production vision call (OpenAI / Groq)
  try {
    const response = await llm.chat.completions.create({
      model: VISION_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract the merchant name, total amount, and date from the receipt image.
              Determine if the receipt matches this rule:
              - Max allowed amount: ${rule.maxAmount} cUSD (or equivalent fiat, assume 1:1 for simplicity)
              ${rule.merchant ? `- Merchant name must contain: "${rule.merchant}"` : ""}
              
              Return a JSON object:
              {
                "merchant": "Extracted Merchant Name",
                "amount": 12.34,
                "date": "YYYY-MM-DD",
                "valid": true/false,
                "reason": "Why valid/invalid"
              }`
            },
            {
              type: "image_url",
              image_url: { url: proof.imageUrl }
            }
          ]
        }
      ]
    });

    const content = response.choices[0].message.content;
    if (!content) return false;

    console.log("[Verifier: Receipt] OpenAI Response:", content);
    const result = JSON.parse(content);
    return result.valid === true;
  } catch (err) {
    console.error("[Verifier: Receipt] Error calling OpenAI:", err);
    return false;
  }
}
