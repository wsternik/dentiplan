// Server-authoritative quote approval (S-01 Phase 3, extended by S-03).
//
// Turns a validated editor payload into a frozen, immutable `approved` quote and
// returns its patient-link token. This is the ONLY place money is frozen, so the
// server never trusts client-sent prices: items arrive by `id` and are re-resolved
// by the shared payload service (FR-050). Totals are recomputed with the same pure
// engine the editor previews with, so the stored number equals the previewed one.
//
// Two entry branches (S-03):
//   - no `id`  → one INSERT of an already-`approved` row. Never INSERT-draft-then-
//                UPDATE, which would trip the `quotes_immutable` trigger.
//   - with `id`→ one UPDATE of an existing draft, setting status/token/approved_at/
//                content together. A single statement is load-bearing: splitting it
//                would leave the row `approved` with a NULL token, violating
//                `quotes_approved_has_token`, and the follow-up statement would then
//                be rejected by the trigger — a permanently broken row that FR-053
//                makes uncorrectable.
//
// PATIENT-SAFE INVARIANT (FR-066): `content` is returned verbatim to anon callers.
// It is built by `buildQuoteContent`, whose types have no e-mail slot; the patient's
// e-mail travels as a sibling of the tree and lands in its own column (FR-072).

import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { computeQuoteTotals } from "@/lib/quote/cost";
import { generateToken } from "@/lib/quote/token";
import {
  approvalBlockReason,
  buildQuoteContent,
  PatientEmailSchema,
  QuotePayloadSchema,
} from "@/lib/services/quote-payload";
import type { QuoteContent } from "@/types";

export const prerender = false;

// The e-mail is REQUIRED here (unlike on a draft): FR-070 promises the admin list
// shows the recipient for every quote, and an approved row is immutable, so a
// missing e-mail could never be filled in afterwards.
const ApproveRequestSchema = QuotePayloadSchema.extend({
  id: z.uuid().optional(),
  patient_email: PatientEmailSchema,
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
  let content: QuoteContent;
  try {
    content = buildQuoteContent(payload);
  } catch {
    // buildQuoteContent throws on an unknown id — a dangling reference.
    return jsonError("Nieznana pozycja z cennika.", 400);
  }

  // (4) Server-side approval guards (don't rely on the client gate).
  const blocked = approvalBlockReason(content);
  if (blocked) {
    return jsonError(blocked, 400);
  }

  // (5) Compute authoritative totals with the same pure engine the editor previews with.
  content.totals = computeQuoteTotals(content);

  // (6) Freeze: one statement, either branch.
  const token = generateToken();
  const approvedAt = new Date().toISOString();

  if (payload.id) {
    // `.eq("status", "draft")` keeps an already-approved row unreachable, and
    // `.select("id")` is what makes a zero-row match observable at all — without
    // it the call resolves with `data: null` whether it hit one row or none.
    const { data, error } = await supabase
      .from("quotes")
      .update({
        status: "approved",
        patient_type: payload.patient_type,
        patient_email: payload.patient_email,
        content,
        token,
        approved_at: approvedAt,
      })
      .eq("id", payload.id)
      .eq("status", "draft")
      .select("id");
    if (error) {
      return jsonError("Nie udało się zapisać kosztorysu.", 500);
    }
    if (data.length === 0) {
      return jsonError("Kosztorys nie istnieje albo został już zatwierdzony.", 409);
    }
  } else {
    const { error } = await supabase.from("quotes").insert({
      status: "approved",
      patient_type: payload.patient_type,
      patient_email: payload.patient_email,
      content,
      token,
      approved_at: approvedAt,
    });
    if (error) {
      return jsonError("Nie udało się zapisać kosztorysu.", 500);
    }
  }

  // (7) Return the token (and the patient path for convenience).
  return new Response(JSON.stringify({ token, path: `/p/${token}` }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
