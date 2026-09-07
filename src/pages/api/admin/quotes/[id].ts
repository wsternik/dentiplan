// Draft update and deletion (S-03).
//
// Both operations are scoped to `status = 'draft'` in the statement itself, so an
// approved quote is unreachable from here (FR-053). That scoping is the whole
// guard for DELETE: the `quotes_immutable` trigger covers UPDATE only — it
// deliberately leaves DELETE open so S-04 retention can purge aged quotes — which
// makes the application layer the only thing standing between a stray request and
// a destroyed patient link.
//
// `.select("id")` on both statements is load-bearing, not decoration: without it
// the Supabase call resolves with `data: null` and no error whether it matched one
// row or none, so "you may not touch an approved quote" would answer 200.

import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import {
  buildQuoteContent,
  DiagnosisNoteSchema,
  PatientEmailSchema,
  QuotePayloadSchema,
} from "@/lib/services/quote-payload";

export const prerender = false;

const DraftRequestSchema = QuotePayloadSchema.extend({
  patient_email: PatientEmailSchema.nullish(),
  diagnosis_note: DiagnosisNoteSchema,
});

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const NOT_A_DRAFT = "Kosztorys nie istnieje albo został już zatwierdzony.";

export const PUT: APIRoute = async (context) => {
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

  const id = z.uuid().safeParse(context.params.id);
  if (!id.success) {
    return jsonError("Nieprawidłowy identyfikator kosztorysu.", 400);
  }

  let payload: z.infer<typeof DraftRequestSchema>;
  try {
    const body: unknown = await context.request.json();
    payload = DraftRequestSchema.parse(body);
  } catch {
    return jsonError("Nieprawidłowe dane kosztorysu.", 400);
  }

  let content;
  try {
    content = buildQuoteContent(payload);
  } catch {
    return jsonError("Nieznana pozycja z cennika.", 400);
  }

  const { data, error } = await supabase
    .from("quotes")
    .update({
      patient_type: payload.patient_type,
      patient_email: payload.patient_email ?? null,
      diagnosis_note: payload.diagnosis_note,
      content,
    })
    .eq("id", id.data)
    .eq("status", "draft")
    .select("id");
  if (error) {
    return jsonError("Nie udało się zapisać szkicu.", 500);
  }
  if (data.length === 0) {
    return jsonError(NOT_A_DRAFT, 409);
  }

  return new Response(null, { status: 204 });
};

export const DELETE: APIRoute = async (context) => {
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

  const id = z.uuid().safeParse(context.params.id);
  if (!id.success) {
    return jsonError("Nieprawidłowy identyfikator kosztorysu.", 400);
  }

  const { data, error } = await supabase.from("quotes").delete().eq("id", id.data).eq("status", "draft").select("id");
  if (error) {
    return jsonError("Nie udało się usunąć szkicu.", 500);
  }
  if (data.length === 0) {
    return jsonError(NOT_A_DRAFT, 409);
  }

  return new Response(null, { status: 204 });
};
