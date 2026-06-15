import type { WarrantStatusName } from "@/lib/types";

const LABEL: Record<WarrantStatusName, string> = {
  OPEN: "Open",
  CLAIMED: "Claimed",
  RELEASED: "Released",
  REFUNDED: "Refunded",
};

const CLASS: Record<WarrantStatusName, string> = {
  OPEN: "badge-open",
  CLAIMED: "badge-claimed",
  RELEASED: "badge-released",
  REFUNDED: "badge-refunded",
};

export function StatusBadge({ status }: { status: WarrantStatusName }) {
  return <span className={`badge ${CLASS[status]}`}>{LABEL[status]}</span>;
}
