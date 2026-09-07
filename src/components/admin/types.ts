// Shared shapes for the admin quote editor island (S-01, Phase 2).

import type { PickerOption } from "@/lib/pricing";
import type { PatientType, QuoteContent } from "@/types";

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
  /** Admin-only raw diagnosis note; stored beside `content`, never inside it. */
  initialDiagnosisNote?: string | null;
  /**
   * Render an approved quote as it was composed, with nothing that could change
   * it (FR-053). Paired with `patientToken` so the patient link stays reachable
   * from the panel.
   */
  readOnly?: boolean;
  /** The approved quote's patient token; only meaningful with `readOnly`. */
  patientToken?: string | null;
}
