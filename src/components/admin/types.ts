// Shared shapes for the admin quote editor island (S-01, Phase 2).

import type { PricelistItemRef } from "@/types";

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

/** Props the admin page passes into the `<QuoteEditor>` island. */
export interface QuoteEditorProps {
  /** Items pickable per tooth (FR-025), pre-resolved + category-tagged. */
  toothOptions: PickerOption[];
  /** Items pickable as general (non-per-tooth) items (FR-029). */
  generalOptions: PickerOption[];
}
