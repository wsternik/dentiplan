// Draft creation (S-03).
//
// Persists the editor's working tree as a `draft` row so an unfinished quote
// survives leaving the page. Deliberately applies NO completeness guards — an
// incomplete draft is the normal case, and approval is the only gate that has to
// be strict (see `approve.ts`).
//
// Prices are still re-resolved server-side by the shared payload service: a draft
// becomes an approved quote by id later, so letting unvalidated data in here would
// only move the problem downstream.

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

// The e-mail is optional on a draft (required only to approve): "start the quote
// now, add the e-mail after the consultation" is a real surgery workflow.
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

export const POST: APIRoute = async (context) => {
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

  // `token` and `approved_at` stay NULL: the approved-row check constraints are
  // scoped to `status = 'approved'`, so a draft legitimately carries neither.
  //
  // The Supabase client is untyped (no `Database` generic), so the result is
  // funnelled through a Zod schema rather than trusted as `any` — same convention
  // as the patient page's RPC call in `src/pages/p/[token].astro`.
  const { data, error } = (await supabase
    .from("quotes")
    .insert({
      status: "draft",
      patient_type: payload.patient_type,
      patient_email: payload.patient_email ?? null,
      diagnosis_note: payload.diagnosis_note,
      content,
    })
    .select("id")
    .single()) as { data: unknown; error: { message: string } | null };
  const inserted = z.object({ id: z.uuid() }).safeParse(data);
  if (error || !inserted.success) {
    return jsonError("Nie udało się zapisać szkicu.", 500);
  }

  return new Response(JSON.stringify({ id: inserted.data.id }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
