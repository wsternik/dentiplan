// Diagnosis-note prefill (S-02, FR-011/FR-012).
//
// The one place in the app that sends anything to a third party, and it sends
// exactly one thing: the text the dentystka pasted into the scratch field. No
// identifier, no e-mail, no quote id — `parseDiagnosis` takes a string and has
// no second content parameter, so there is no path for one (FR-072).
//
// Reads nothing from the database and writes nothing to it. The response is the
// write endpoints' request shape with pricelist ids already resolved from the
// seed; the editor merges it into island state and the dentystka approves by
// hand, exactly as before (FR-013).
//
// A failure is never a 200 with an empty tree. The caller has to be able to
// tell "the note produced nothing" from "the call did not happen", because only
// the second one means "fill the form in yourself".

import type { APIRoute } from "astro";
import { z } from "zod";

import { anthropicModel, isModelConfigured } from "@/lib/llm/client";
import { parseDiagnosis } from "@/lib/llm/parse-diagnosis";
import { createClient } from "@/lib/supabase";

export const prerender = false;

// The first request-size bound in this app, and the only thing between a
// stray paste and a bill. A consultation note runs to a few hundred characters;
// 4000 is generous for the real case and cheap for the abusive one.
const MAX_NOTE_CHARS = 4000;

const ParseRequestSchema = z.object({
  text: z.string().trim().min(1).max(MAX_NOTE_CHARS),
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

  let payload: z.infer<typeof ParseRequestSchema>;
  try {
    const body: unknown = await context.request.json();
    payload = ParseRequestSchema.parse(body);
  } catch {
    return jsonError("Nieprawidłowa notatka.", 400);
  }

  // A missing key is a configuration state, not a fault: say so distinctly, so
  // the panel can tell the dentystka the button is off rather than broken.
  if (!isModelConfigured()) {
    return jsonError("Wypełnianie z notatki jest niedostępne.", 503);
  }

  let result;
  try {
    result = await parseDiagnosis(payload.text, anthropicModel());
  } catch {
    // Deliberately opaque to the caller and deliberately terminal: a provider
    // error, a timeout, or an answer that would not validate all mean the same
    // thing to her — fill the form in by hand (FR-013).
    return jsonError("Nie udało się przetworzyć notatki — wypełnij formularz ręcznie.", 502);
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
