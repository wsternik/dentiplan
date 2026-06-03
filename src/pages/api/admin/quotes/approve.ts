// Server-authoritative quote approval (S-01, Phase 3).
//
// Turns a validated editor payload into a frozen, immutable `approved` quote and
// returns its patient-link token. This is the ONLY place money is frozen, so the
// server never trusts client-sent prices: items arrive by `id` and are re-resolved
// here via `resolvePricelistItem` (FR-050). Totals are recomputed with the same
// pure engine the editor previews with, so the stored number equals the previewed
// number. The whole thing is one INSERT-as-approved (status/token/approved_at/
// frozen content set atomically) — never INSERT-draft-then-UPDATE, which would
// trip the `quotes_immutable` trigger (see plan Critical Implementation Details).
//
// PATIENT-SAFE INVARIANT (FR-066): `content` is returned verbatim to anon callers.
// We build `content` from ONLY the patient-safe tree (teeth/visits/generalItems/
// totals). The raw diagnosis textarea is held in island state and is never part of
// this payload — nothing here can leak it.

import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { resolvePricelistItem } from "@/lib/pricing";
import { computeQuoteTotals } from "@/lib/quote/cost";
import { generateToken } from "@/lib/quote/token";
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

export const prerender = false;

// --- Request schema -------------------------------------------------------
// Mirrors the editor's working tree but carries pricelist items BY ID only.
// The server re-resolves each id into a frozen `PricelistItemRef`; a client-sent
// price would never be trusted (a buggy/tampered client must not freeze wrong
// money into an immutable patient quote).

const ApproveToothSchema = z.object({
  number: z.number().int(),
  treatmentType: TreatmentTypeSchema.nullable().default(null),
  urgency: UrgencySchema.nullable().default(null),
  status: ToothStatusSchema.default("in-plan"),
  note: z.string().default(""),
  pricelistItemIds: z.array(z.string()).default([]),
  visitNumber: z.number().int().nullable().default(null),
});

const ApproveGeneralSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  visitNumber: z.number().int().nullable().default(null),
});

const ApproveRequestSchema = z.object({
  patient_type: PatientTypeSchema,
  teeth: z.array(ApproveToothSchema).default([]),
  visits: z.array(VisitSchema).default([]),
  generalItems: z.array(ApproveGeneralSchema).default([]),
});

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async (context) => {
  // (1) Require an authenticated user.
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("Supabase nie jest skonfigurowany.", 500);
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonError("Wymagane zalogowanie.", 401);
  }

  // (2) Parse the body against the request schema.
  let payload: z.infer<typeof ApproveRequestSchema>;
  try {
    const body: unknown = await context.request.json();
    payload = ApproveRequestSchema.parse(body);
  } catch {
    return jsonError("Nieprawidłowe dane kosztorysu.", 400);
  }

  // (3) Build the patient-safe content, freezing each pricelist item by id.
  let teeth: ToothEntry[];
  let generalItems: GeneralItem[];
  try {
    teeth = payload.teeth.map((tooth) => ({
      number: tooth.number,
      treatmentType: tooth.treatmentType,
      urgency: tooth.urgency,
      status: tooth.status,
      note: tooth.note,
      pricelistItems: tooth.pricelistItemIds.map((id) => resolvePricelistItem(id)),
      visitNumber: tooth.visitNumber,
    }));
    generalItems = payload.generalItems.map((general) => ({
      id: general.id,
      item: resolvePricelistItem(general.itemId),
      visitNumber: general.visitNumber,
    }));
  } catch {
    // resolvePricelistItem throws on an unknown id — a dangling reference.
    return jsonError("Nieznana pozycja z cennika.", 400);
  }

  // (4) Server-side approval guards (don't rely on the client guard).
  const isEmpty = teeth.length === 0 && generalItems.length === 0;
  const hasUnpriced = teeth.some((t) => t.status === "in-plan" && t.pricelistItems.length === 0);
  if (isEmpty || hasUnpriced) {
    return jsonError(isEmpty ? "Kosztorys jest pusty." : "Każdy ząb w planie musi mieć pozycję z cennika.", 400);
  }

  // (5) Compute authoritative totals with the same pure engine the editor previews with.
  const content: QuoteContent = { teeth, visits: payload.visits, generalItems };
  content.totals = computeQuoteTotals(content);

  // (6) Generate the capability token and INSERT one immutable approved row.
  const token = generateToken();
  const { error } = await supabase.from("quotes").insert({
    status: "approved",
    patient_type: payload.patient_type,
    content,
    token,
    approved_at: new Date().toISOString(),
  });
  if (error) {
    return jsonError("Nie udało się zapisać kosztorysu.", 500);
  }

  // (7) Return the token (and the patient path for convenience).
  return new Response(JSON.stringify({ token, path: `/p/${token}` }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
