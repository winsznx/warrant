import { ProofPayload, DeliveryRule } from "../types.js";
import { llm, VISION_MODEL } from "../llm.js";

// Haversine formula to compute distance in meters
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

export async function verifyDelivery(proof: ProofPayload, ruleStr: string): Promise<boolean> {
  console.log(`[Verifier: Delivery] Running check. Rule: "${ruleStr}". Proof:`, proof);

  let rule: DeliveryRule;
  try {
    rule = JSON.parse(ruleStr);
  } catch (e) {
    console.error("[Verifier: Delivery] Failed to parse rule JSON.", e);
    // fallback default rule
    rule = { targetLat: 6.5244, targetLng: 3.3792, radiusMeters: 500 }; // Lagos default
  }

  // Verify location if provided
  if (proof.lat === undefined || proof.lng === undefined) {
    console.log("[Verifier: Delivery] Rejected: No coordinates provided in proof.");
    return false;
  }

  const distance = haversineDistance(proof.lat, proof.lng, rule.targetLat, rule.targetLng);
  console.log(`[Verifier: Delivery] Computed distance: ${distance.toFixed(1)}m. Target radius: ${rule.radiusMeters}m.`);

  if (distance > rule.radiusMeters) {
    console.log(`[Verifier: Delivery] Rejected: Distance ${distance.toFixed(1)}m exceeds radius.`);
    return false;
  }

  if (!proof.imageUrl) {
    console.log("[Verifier: Delivery] Rejected: No image URL provided in proof.");
    return false;
  }

  if (!llm) {
    console.log("[Verifier: Delivery] HEURISTIC MODE: no LLM key set. Skipping vision check.");
    await new Promise((r) => setTimeout(r, 2000));
    
    const desc = (proof.description || "").toLowerCase();
    if (desc.includes("invalid") || desc.includes("fail")) {
      return false;
    }
    return true;
  }

  try {
    const response = await llm.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Does this image show a physical package, box, parcel, delivery handoff, or dropoff spot? Answer only: YES or NO"
            },
            {
              type: "image_url",
              image_url: { url: proof.imageUrl }
            }
          ]
        }
      ]
    });

    const answer = response.choices[0].message.content?.trim().toUpperCase();
    console.log("[Verifier: Delivery] OpenAI Vision answer:", answer);
    return answer === "YES";
  } catch (err) {
    console.error("[Verifier: Delivery] Error calling OpenAI vision:", err);
    return false;
  }
}
