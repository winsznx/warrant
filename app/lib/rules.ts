import type { ConditionTypeName } from "./types";

export interface ReceiptRule {
  maxAmount: number;
  merchant?: string;
}

export interface DeliveryRule {
  targetLat: number;
  targetLng: number;
  radiusMeters: number;
}

export interface MilestoneRule {
  owner: string;
  repo: string;
  branch: string;
}

export type ParsedRule =
  | { type: "RECEIPT"; rule: ReceiptRule }
  | { type: "DELIVERY"; rule: DeliveryRule }
  | { type: "MILESTONE"; rule: MilestoneRule }
  | { type: "MANUAL"; rule: string };

/** Serialize the per-condition rule inputs into the `ruleURI` stored on-chain. */
export function encodeRule(
  type: ConditionTypeName,
  fields: {
    receiptMaxAmount?: string;
    receiptMerchant?: string;
    deliveryLat?: string;
    deliveryLng?: string;
    deliveryRadius?: string;
    milestoneOwner?: string;
    milestoneRepo?: string;
    milestoneBranch?: string;
    manualRule?: string;
  },
): string {
  switch (type) {
    case "RECEIPT":
      return JSON.stringify({
        maxAmount: Number.parseFloat(fields.receiptMaxAmount ?? "0") || 0,
        merchant: fields.receiptMerchant?.trim() || undefined,
      } satisfies ReceiptRule);
    case "DELIVERY":
      return JSON.stringify({
        targetLat: Number.parseFloat(fields.deliveryLat ?? "0") || 0,
        targetLng: Number.parseFloat(fields.deliveryLng ?? "0") || 0,
        radiusMeters: Number.parseInt(fields.deliveryRadius ?? "100", 10) || 100,
      } satisfies DeliveryRule);
    case "MILESTONE":
      return JSON.stringify({
        owner: fields.milestoneOwner?.trim() ?? "",
        repo: fields.milestoneRepo?.trim() ?? "",
        branch: fields.milestoneBranch?.trim() || "main",
      } satisfies MilestoneRule);
    case "MANUAL":
      return fields.manualRule?.trim() || "Custom verification required";
  }
}

function safeParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function parseRule(type: ConditionTypeName, ruleURI: string): ParsedRule {
  switch (type) {
    case "RECEIPT": {
      const rule = safeParse<ReceiptRule>(ruleURI) ?? { maxAmount: 0 };
      return { type, rule };
    }
    case "DELIVERY": {
      const rule =
        safeParse<DeliveryRule>(ruleURI) ?? {
          targetLat: 0,
          targetLng: 0,
          radiusMeters: 100,
        };
      return { type, rule };
    }
    case "MILESTONE": {
      const rule =
        safeParse<MilestoneRule>(ruleURI) ?? { owner: "", repo: "", branch: "main" };
      return { type, rule };
    }
    case "MANUAL":
      return { type, rule: ruleURI };
  }
}

/** Human-readable one-line summary of a warrant's verification rule. */
export function ruleSummary(type: ConditionTypeName, ruleURI: string): string {
  const parsed = parseRule(type, ruleURI);
  switch (parsed.type) {
    case "RECEIPT":
      return `Receipt total ≤ ${parsed.rule.maxAmount} cUSD${
        parsed.rule.merchant ? ` · merchant contains "${parsed.rule.merchant}"` : ""
      }`;
    case "DELIVERY":
      return `Delivery within ${parsed.rule.radiusMeters}m of ${parsed.rule.targetLat}, ${parsed.rule.targetLng}`;
    case "MILESTONE":
      return `PR merged to ${parsed.rule.owner}/${parsed.rule.repo} @ ${parsed.rule.branch}`;
    case "MANUAL":
      return parsed.rule;
  }
}
