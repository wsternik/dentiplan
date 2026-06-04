// Patient-facing PLN + date formatting (S-01, Phase 4 / Localization NFR).
//
// Pure, no UI/IO. The patient page frames costs with the "od X zł" phrasing:
// a single headline figure (the lower bound), pushing any range-driven upside
// into the "Scenariusze" section rather than printing min–max everywhere
// (FR-026 resolution). The admin live preview uses its own min–max formatter
// (`src/components/admin/format.ts`); this module is the patient phrasing.

import type { CostRange } from "@/types";

/** Format a plain PLN amount, e.g. `1 400 zł` (pl-PL grouping). */
export function formatAmount(amount: number): string {
  return `${amount.toLocaleString("pl-PL")} zł`;
}

/**
 * The patient headline for a cost range: a single figure. A point cost
 * (`min === max`) renders bare (`X zł`); a true range renders as `od X zł`
 * (its lower bound), keeping one clear number in front of the patient. The
 * upper-bound increase is surfaced separately in the Scenariusze section.
 */
export function formatRangeHeadline(range: CostRange): string {
  return range.min === range.max ? formatAmount(range.min) : `od ${formatAmount(range.min)}`;
}

/** True when a range has a real upside (max strictly above min). */
export function hasRangeUpside(range: CostRange): boolean {
  return range.max > range.min;
}

/**
 * Format an ISO timestamp as `DD.MM.YYYY` (pl date convention). Uses UTC fields
 * so the output is deterministic regardless of the runtime's local timezone.
 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}
