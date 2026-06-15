import { FileText, MapPin, GitBranch, ShieldCheck } from "lucide-react";
import type { ConditionTypeName } from "@/lib/types";

export const CONDITION_LABEL: Record<ConditionTypeName, string> = {
  RECEIPT: "Receipt Expense Check",
  DELIVERY: "Geofenced Delivery Check",
  MILESTONE: "GitHub Milestone Check",
  MANUAL: "Custom Rule Judgment",
};

export const CONDITION_TAGLINE: Record<ConditionTypeName, string> = {
  RECEIPT: "Expense verification using OpenAI Vision",
  DELIVERY: "Geofenced location + image verification",
  MILESTONE: "Auto-releases when a GitHub PR merges",
  MANUAL: "Custom English rule judged by AI",
};

export function ConditionIcon({
  type,
  size = 18,
}: {
  type: ConditionTypeName;
  size?: number;
}) {
  switch (type) {
    case "RECEIPT":
      return <FileText size={size} />;
    case "DELIVERY":
      return <MapPin size={size} />;
    case "MILESTONE":
      return <GitBranch size={size} />;
    case "MANUAL":
      return <ShieldCheck size={size} />;
  }
}
