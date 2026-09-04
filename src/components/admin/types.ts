// Shared shapes for the admin quote editor island (S-01, Phase 2).

import type { PatientType, PricelistItemRef, QuoteContent } from "@/types";

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
  /**
   * The stored quote this editor was opened from (S-03). Absent on
   * `/admin/quotes/new`; present when reopening from the list, in which case
   * "Zapisz szkic" updates this row instead of creating another one.
   */
  quoteId?: string;
  /** Stored tree to rehydrate from; absent means a blank quote. */
  initialContent?: QuoteContent;
  initialPatientType?: PatientType;
  /** Admin-only recipient e-mail (FR-072); never part of `content`. */
  initialPatientEmail?: string | null;
  /**
   * Render an approved quote as it was composed, with nothing that could change
   * it (FR-053). Paired with `patientToken` so the patient link stays reachable
   * from the panel.
   */
  readOnly?: boolean;
  /** The approved quote's patient token; only meaningful with `readOnly`. */
  patientToken?: string | null;
}
