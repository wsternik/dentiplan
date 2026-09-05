// Picker options for the admin editor (S-03).
//
// The editor's pickers need RESOLVED options, not raw source items: the cost
// engine's input is `PricelistItemRef[]` (carrying a resolved `price`), so each
// source item is mapped through `resolvePricelistItem(id)` server-side and tagged
// with its category label — item names are NOT globally unique (FR-025), so the
// picker disambiguates by category.
//
// Derived identically for every quote, and now needed by three routes
// (`/admin/quotes/new`, `/admin/quotes/[id]`, and any later editor surface), so it
// lives here rather than being copy-pasted per page.
//
// The resolved `price` is for LIVE PREVIEW only. Every write path still POSTs by
// `id` and the server re-resolves independently (FR-050).

import type { PricelistItemRef } from "@/types";

import { listByCategory, resolvePricelistItem } from "./resolver";

/**
 * A picker option as serialized from the server (admin page) into the island.
 * It is a resolved `PricelistItemRef` (so it can feed `computeQuoteTotals`
 * directly for live preview) plus the `category` label used to disambiguate the
 * picker — pricelist item names are NOT globally unique (FR-025). The approval
 * payload still POSTs by `id`; the resolved `price` here is preview-only and is
 * never trusted for the server-side freeze (Phase 3).
 */
export interface PickerOption extends PricelistItemRef {
  category: string;
}

export interface PickerOptions {
  /** Items pickable per tooth (FR-025). */
  toothOptions: PickerOption[];
  /** Items pickable as general, non-per-tooth items (FR-029). */
  generalOptions: PickerOption[];
}

export function buildPickerOptions(): PickerOptions {
  const categories = listByCategory();

  const forContext = (predicate: (item: { validForTooth: boolean; validForGeneral: boolean }) => boolean) =>
    categories.flatMap((category) =>
      category.items.filter(predicate).map((item) => ({ ...resolvePricelistItem(item.id), category: category.name })),
    );

  return {
    toothOptions: forContext((item) => item.validForTooth),
    generalOptions: forContext((item) => item.validForGeneral),
  };
}
