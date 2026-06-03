// Lightweight money formatting for the admin editor's LIVE PREVIEW only.
//
// This is preview ergonomics for the dentystka — not the patient-facing phrasing
// (the "od X zł" patient framing lives in `src/lib/quote/format.ts`, Phase 4).
// Pure; safe in the browser island.

import type { CostRange, PriceValue } from "@/types";

/** Format a plain PLN amount, e.g. `1 400 zł` (pl-PL grouping). */
export function formatPln(amount: number): string {
  return `${amount.toLocaleString("pl-PL")} zł`;
}

/** Format a cost range; collapses to a single figure when `min === max`. */
export function formatRange(range: CostRange): string {
  return range.min === range.max
    ? formatPln(range.min)
    : `${range.min.toLocaleString("pl-PL")}–${formatPln(range.max)}`;
}

/** Compact label for a single pricelist item's price, for picker/row display. */
export function formatPriceValue(price: PriceValue): string {
  switch (price.kind) {
    case "fixed":
      return formatPln(price.amount);
    case "range":
      return formatRange({ min: price.min, max: price.max });
    case "modifier":
      return `+${formatPln(price.amount)}`;
    case "from":
      return `od ${formatPln(price.amount)}`;
  }
}
