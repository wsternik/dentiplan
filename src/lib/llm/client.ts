// The one network call in S-02, behind a one-method seam.
//
// This is the only module in `src/lib/llm/` that touches the provider or
// `astro:env`, which is what lets `parse-diagnosis.ts` and its tests stay pure:
// the endpoint composes the two, nothing else imports this file. (vitest has no
// `astro:env` stub, so a static import of it anywhere in the tested graph would
// take the suite down before the first assertion.)
//
// No tool loop, deliberately — the model reads a note and answers; it calls
// nothing and changes nothing, so a loop would be scaffolding around a single
// request. Same shape as `scripts/review/agent.ts`.

import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { ANTHROPIC_API_KEY, LLM_MODEL } from "astro:env/server";

import { buildInstructions } from "./prompt";
import { ParsedDiagnosisSchema, type ParsedDiagnosis } from "./schema";

// Pinned rather than discovered, for the same reason `scripts/review/agent.ts`
// pins its own: the model id is the knob a change here most needs to be
// deliberate about. LLM_MODEL overrides it per environment without a deploy.
const DEFAULT_MODEL = "claude-sonnet-5";

// This call sits on a request path, so both are set explicitly rather than left
// to the SDK's defaults — a slow provider must not hold a Worker request open.
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 1;

/** The seam. `parseDiagnosis` takes one of these; only the endpoint builds one. */
export interface DiagnosisModel {
  read(text: string): Promise<ParsedDiagnosis>;
}

/** True when the key is configured; the endpoint answers 503 rather than 500. */
export function isModelConfigured(): boolean {
  return Boolean(ANTHROPIC_API_KEY);
}

export function anthropicModel(): DiagnosisModel {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  // The key is passed explicitly rather than picked up from the environment:
  // on Workers the secret arrives through `astro:env/server`, and the provider's
  // own `process.env` lookup would find nothing there.
  const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY });

  return {
    async read(text: string): Promise<ParsedDiagnosis> {
      const { output } = await generateText({
        model: anthropic(LLM_MODEL ?? DEFAULT_MODEL),
        instructions: buildInstructions(),
        output: Output.object({ schema: ParsedDiagnosisSchema }),
        prompt: `Notatka dentystki:\n\n${text}`,
        timeout: TIMEOUT_MS,
        maxRetries: MAX_RETRIES,
      });
      return output;
    },
  };
}
