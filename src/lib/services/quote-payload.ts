// Shared admin write-path payload contract (S-03).
//
// Extracted verbatim in behaviour from the S-01 approval endpoint so the draft
// and approval paths cannot drift: both parse the same schema and build `content`
// through the same function. What one validates, the other validates.
//
// SERVER-AUTHORITATIVE PRICES (FR-050): pricelist items arrive BY ID only and are
// re-resolved here. A client-sent price is never trusted — a buggy or tampered
// client must not be able to freeze wrong money into a patient-visible quote.
//
// PATIENT-SAFE INVARIANT (FR-066): `content` is returned verbatim to anon callers
// by `get_quote_by_token`, and the RPC's column whitelist does NOT inspect fields
// nested inside it. The patient's e-mail is therefore not part of this module at
// all — neither the request schema nor `buildQuoteContent` has a slot for it, so
// no caller can nest one by accident. It travels as a sibling of `content` in the
// request body and lands in the `patient_email` column (FR-072, risk #3 in
// context/foundation/test-plan.md).

import { z } from "zod";
import { resolvePricelistItem } from "@/lib/pricing";
import { isValidToothNumber } from "@/lib/quote/tooth-name";
import {
  PatientTypeSchema,
  ToothStatusSchema,
  TreatmentTypeSchema,
  UrgencySchema,
  VisitSchema,
  type GeneralItem,
  type QuoteContent,
  type ToothEntry,
} from "@/types";

// --- Request schema -------------------------------------------------------
// Mirrors the editor's working tree but carries pricelist items BY ID only.
//
// FDI numbers and free-text bounds are re-validated here even though the editor
// enforces them client-side: the server write is authoritative and must not trust
// a buggy/tampered client to keep structurally-invalid or oversized data out of a
// quote whose `note` is rendered verbatim to patients.

const QuoteToothSchema = z.object({
  number: z.number().int().refine(isValidToothNumber, "Nieprawidłowy numer zęba."),
  treatmentType: TreatmentTypeSchema.nullable().default(null),
  urgency: UrgencySchema.nullable().default(null),
  status: ToothStatusSchema.default("in-plan"),
  note: z.string().max(500).default(""),
  pricelistItemIds: z.array(z.string().max(64)).default([]),
  visitNumber: z.number().int().nullable().default(null),
});

const QuoteGeneralSchema = z.object({
  id: z.string().max(64),
  itemId: z.string().max(64),
  visitNumber: z.number().int().nullable().default(null),
});

/**
 * The quote tree as every admin write endpoint accepts it. Deliberately carries
 * no e-mail — see the patient-safe invariant above.
 */
export const QuotePayloadSchema = z.object({
  patient_type: PatientTypeSchema,
  teeth: z.array(QuoteToothSchema).default([]),
  visits: z.array(VisitSchema).default([]),
  generalItems: z.array(QuoteGeneralSchema).default([]),
});

export type QuotePayload = z.infer<typeof QuotePayloadSchema>;

/**
 * The patient's e-mail: admin-only (FR-072), stored in its own column. Optional
 * on a draft — an unfinished quote is the normal case — and required by the
 * approval endpoint, which applies this schema without `.optional()`.
 */
export const PatientEmailSchema = z.email("Nieprawidłowy adres e-mail.").max(254);

/**
 * Build the patient-safe `content` tree from a parsed payload, freezing each
 * pricelist item by id.
 *
 * `totals` is deliberately left unset: `QuoteContentSchema` marks it optional and
 * it is the frozen, authoritative number that only approval computes. A draft
 * stores the tree without it; the editor recomputes live on load.
 *
 * @throws when a pricelist id does not resolve (a dangling reference) — callers
 *   map this to a 400.
 */
export function buildQuoteContent(payload: QuotePayload): QuoteContent {
  const teeth: ToothEntry[] = payload.teeth.map((tooth) => ({
    number: tooth.number,
    treatmentType: tooth.treatmentType,
    urgency: tooth.urgency,
    status: tooth.status,
    note: tooth.note,
    pricelistItems: tooth.pricelistItemIds.map((id) => resolvePricelistItem(id)),
    visitNumber: tooth.visitNumber,
  }));

  const generalItems: GeneralItem[] = payload.generalItems.map((general) => ({
    id: general.id,
    item: resolvePricelistItem(general.itemId),
    visitNumber: general.visitNumber,
  }));

  return { teeth, visits: payload.visits, generalItems };
}

/**
 * The approval-readiness guards, shared by the client gate and the server freeze.
 * Returns a Polish message when the quote may not be approved, or `null` when it
 * may. Draft saves deliberately do not apply these — an incomplete draft is the
 * normal case.
 */
export function approvalBlockReason(content: QuoteContent): string | null {
  if (content.teeth.length === 0 && content.generalItems.length === 0) {
    return "Kosztorys jest pusty.";
  }
  if (content.teeth.some((tooth) => tooth.status === "in-plan" && tooth.pricelistItems.length === 0)) {
    return "Każdy ząb w planie musi mieć pozycję z cennika.";
  }
  return null;
}
