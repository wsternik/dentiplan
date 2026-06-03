// DentiPlan shared domain types & DTOs (F-01 foundation).
//
// This module is the single source of truth for the JSONB `content` contract and
// the row-level shape every later slice (S-01–S-04) imports. Types are derived
// from their Zod schemas via `z.infer` so the runtime validator and the compile-
// time type can never drift. The generated DB row types live in
// `src/db/database.types.ts` (regenerate with `supabase gen types typescript
// --local > src/db/database.types.ts` after any migration).
//
// INVARIANT (FR-066): `get_quote_by_token` returns the entire `content` jsonb
// verbatim to anon. `content` must therefore contain ONLY patient-safe data —
// never internal notes meant for the dentystka, margins, raw LLM output, or any
// identifier. Admin-only data belongs in a dedicated column, never inside
// `content`. The column whitelist does not protect fields nested in `content`.

import { z } from "zod";
import type { Tables } from "@/db/database.types";

export type { Database } from "@/db/database.types";

// ---------------------------------------------------------------------------
// Enumerations (DB-level and content-level)
// ---------------------------------------------------------------------------

/** Lifecycle status of a quote row (DB `status` check constraint). */
export const QuoteStatusSchema = z.enum(["draft", "approved"]);
export type QuoteStatus = z.infer<typeof QuoteStatusSchema>;

/** Patient type, set once per quote and frozen on approval (FR-020). */
export const PatientTypeSchema = z.enum(["child", "adult"]);
export type PatientType = z.infer<typeof PatientTypeSchema>;

/** Per-tooth planning status (FR-027). */
export const ToothStatusSchema = z.enum(["in-plan", "uncertain", "out-of-current-plan"]);
export type ToothStatus = z.infer<typeof ToothStatusSchema>;

/** Treatment type per tooth (FR-023). */
export const TreatmentTypeSchema = z.enum(["extraction", "root-canal", "caries-removal", "filling", "other"]);
export type TreatmentType = z.infer<typeof TreatmentTypeSchema>;

/** Urgency per tooth (FR-024). */
export const UrgencySchema = z.enum(["urgent", "moderate", "mild"]);
export type Urgency = z.infer<typeof UrgencySchema>;

/** Dentition derived from the tooth number (FR-022) — never stored. */
export type Dentition = "milk" | "permanent";

/**
 * Derive dentition from an FDI tooth number (FR-022): 51–85 = milk, 11–48 =
 * permanent. The number → dentition mapping is deterministic and not user-
 * editable, so it is computed on read rather than persisted in `content`.
 * Out-of-range numbers are surfaced as warnings at the form level (FR-012),
 * not here.
 */
export function dentitionForTooth(toothNumber: number): Dentition {
  return toothNumber >= 51 && toothNumber <= 85 ? "milk" : "permanent";
}

// ---------------------------------------------------------------------------
// Pricelist snapshot value (embedded in `content`, F-02 is the live seed)
// ---------------------------------------------------------------------------

/**
 * A resolved price as stored in the approval snapshot: either a single point
 * value or a range (FR-026). Carried inline so an approved quote is self-
 * sufficient and later pricelist edits never alter historical quotes.
 */
export const PriceValueSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fixed"), amount: z.number() }),
  z.object({ kind: z.literal("range"), min: z.number(), max: z.number() }),
]);
export type PriceValue = z.infer<typeof PriceValueSchema>;

/**
 * A snapshot reference to a pricelist item (FR-025): the resolved id, display
 * name, price, and the `localAnesthesia` flag the anesthesia plan uses to auto-
 * skip items (FR-041). Stored by value so the snapshot survives pricelist edits.
 */
export const PricelistItemRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: PriceValueSchema,
  localAnesthesia: z.boolean().default(false),
});
export type PricelistItemRef = z.infer<typeof PricelistItemRefSchema>;

// ---------------------------------------------------------------------------
// Content tree: teeth, visits, general items, optional resolved totals
// ---------------------------------------------------------------------------

/**
 * One tooth row in the working tree (FR-021–FR-028). Fields are nullable/empty-
 * tolerant so a partially-filled draft (or LLM prefill, FR-011) still parses;
 * approval-readiness is an S-01 check layered on top, not enforced here.
 * `visitNumber` links an `in-plan` tooth to a visit (FR-030); `uncertain` and
 * `out-of-current-plan` teeth carry `null`.
 */
export const ToothEntrySchema = z.object({
  number: z.number().int(),
  treatmentType: TreatmentTypeSchema.nullable().default(null),
  urgency: UrgencySchema.nullable().default(null),
  status: ToothStatusSchema.default("in-plan"),
  note: z.string().default(""),
  pricelistItems: z.array(PricelistItemRefSchema).default([]),
  visitNumber: z.number().int().nullable().default(null),
});
export type ToothEntry = z.infer<typeof ToothEntrySchema>;

/** A visit in the standard plan (FR-031). Teeth reference it by `number`. */
export const VisitSchema = z.object({
  number: z.number().int(),
  label: z.string().default(""),
});
export type Visit = z.infer<typeof VisitSchema>;

/**
 * A general (non-per-tooth) item — higienizacja, pantomogram, konsultacja
 * (FR-029). Distinct from teeth: no status, urgency, treatment type, or
 * dentition. Optionally associated with a visit for that visit's partial cost
 * (FR-032).
 */
export const GeneralItemSchema = z.object({
  id: z.string(),
  item: PricelistItemRefSchema,
  visitNumber: z.number().int().nullable().default(null),
});
export type GeneralItem = z.infer<typeof GeneralItemSchema>;

/** A cost range (a point cost collapses to `min === max`). */
export const CostRangeSchema = z.object({ min: z.number(), max: z.number() });
export type CostRange = z.infer<typeof CostRangeSchema>;

/**
 * Optional resolved totals (FR-026/FR-032/FR-064). Present only once S-01 has
 * computed them; the schema leaves room to store resolved values but never
 * requires them, so empty/partial drafts still parse.
 */
export const QuoteTotalsSchema = z.object({
  standard: z
    .object({
      perVisit: z.array(z.object({ visitNumber: z.number().int(), cost: CostRangeSchema })).default([]),
      grandTotal: CostRangeSchema.optional(),
    })
    .optional(),
  anesthesia: z
    .object({
      fee: z.number(),
      total: CostRangeSchema,
    })
    .optional(),
});
export type QuoteTotals = z.infer<typeof QuoteTotalsSchema>;

/**
 * The full `content` jsonb tree. Top-level collections default to `[]` so the
 * DB default `'{}'::jsonb` and partially-filled drafts both parse against this
 * single source of truth. PATIENT-SAFE ONLY (see file-level INVARIANT).
 */
export const QuoteContentSchema = z.object({
  teeth: z.array(ToothEntrySchema).default([]),
  visits: z.array(VisitSchema).default([]),
  generalItems: z.array(GeneralItemSchema).default([]),
  totals: QuoteTotalsSchema.optional(),
});
export type QuoteContent = z.infer<typeof QuoteContentSchema>;

// ---------------------------------------------------------------------------
// Row-level & DTO shapes
// ---------------------------------------------------------------------------

/** Generated row type, with `content` narrowed from `Json` to `QuoteContent`. */
type QuoteRow = Tables<"quotes">;

/**
 * A `quotes` row as the app sees it: the generated row with `content`, `status`,
 * and `patient_type` narrowed from their permissive DB types to the domain
 * unions. Read/write `content` through `QuoteContentSchema`, never the raw
 * `Json` type.
 */
export type Quote = Omit<QuoteRow, "content" | "status" | "patient_type"> & {
  content: QuoteContent;
  status: QuoteStatus;
  patient_type: PatientType;
};

/**
 * The whitelisted shape `get_quote_by_token` returns to the public patient page
 * (FR-060/FR-066): no `patient_email`, `status`, or `token`. Mirrors the RPC's
 * `returns table (...)` column list, with `content` narrowed to `QuoteContent`.
 */
export interface PatientView {
  id: string;
  patient_type: PatientType;
  content: QuoteContent;
  created_at: string;
}
