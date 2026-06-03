// Snapshot resolver + context-aware lookups (F-02 → S-01 surface).
//
// Maps a source pricelist item down to the F-01 `PricelistItemRef` snapshot (the
// by-value shape frozen into a quote's `content` on approval, FR-050) and
// exposes the context-aware lookups S-01 needs to populate per-tooth and
// general-item pickers — so no downstream slice re-encodes pricelist knowledge.

import type { PriceValue, PricelistItemRef } from "@/types";
import type { SourcePricelistItem, PricelistCategory } from "./schema";
import { PRICELIST, ANESTHESIA_FEE_SCHEDULE } from "./seed";

/** Re-exported for S-01's anesthesia fee formula (FR-042/FR-043). */
export { ANESTHESIA_FEE_SCHEDULE };

/** Flat id → item index, built once at module load over the validated seed. */
const ITEMS_BY_ID = new Map<string, SourcePricelistItem>(
  PRICELIST.categories.flatMap((category) => category.items.map((item) => [item.id, item] as const)),
);

/** Look up a source item by stable id, or `undefined` if absent. */
export function findItemById(id: string): SourcePricelistItem | undefined {
  return ITEMS_BY_ID.get(id);
}

/**
 * Convert a source item's raw `price_type`/`price_min`/`price_max` into the
 * F-01 `PriceValue` union. `range` is the only kind carrying a max; the seed's
 * Zod refinement already guarantees it non-null, but we assert here too so a
 * future schema change can't silently produce a malformed snapshot.
 */
function toPriceValue(item: SourcePricelistItem): PriceValue {
  switch (item.price_type) {
    case "fixed":
      return { kind: "fixed", amount: item.price_min };
    case "modifier":
      return { kind: "modifier", amount: item.price_min };
    case "from":
      return { kind: "from", amount: item.price_min };
    case "range":
      if (item.price_max === null) {
        throw new Error(`Pricelist item "${item.id}" is a range but has no price_max.`);
      }
      return { kind: "range", min: item.price_min, max: item.price_max };
  }
}

/**
 * Resolve a source item to its `PricelistItemRef` snapshot — the by-value shape
 * S-01 freezes into `content`. Carries `id`, `name`, the resolved `price`, and
 * the `localAnesthesia` flag (FR-041) through. Throws on an unknown id so a
 * dangling reference fails loudly rather than producing an empty snapshot.
 */
export function resolvePricelistItem(id: string): PricelistItemRef {
  const item = ITEMS_BY_ID.get(id);
  if (!item) {
    throw new Error(`Unknown pricelist item id "${id}".`);
  }
  return {
    id: item.id,
    name: item.name,
    price: toPriceValue(item),
    localAnesthesia: item.localAnesthesia,
  };
}

/** All items pickable per-tooth (FR-025), flattened across categories. */
export function listToothItems(): SourcePricelistItem[] {
  return PRICELIST.categories.flatMap((category) => category.items.filter((item) => item.validForTooth));
}

/** All items pickable as general (non-per-tooth) items (FR-029). */
export function listGeneralItems(): SourcePricelistItem[] {
  return PRICELIST.categories.flatMap((category) => category.items.filter((item) => item.validForGeneral));
}

/** The categories as-is, for grouped rendering of the picker. */
export function listByCategory(): PricelistCategory[] {
  return PRICELIST.categories;
}
