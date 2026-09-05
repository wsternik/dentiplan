// The contract between the review agent and everything downstream of it.
//
// Structured output is the whole point: a free-text "opinion" is something a
// human skims, but a schema-validated object is something a workflow can key
// off — pick a label, decide whether to comment, count findings over time.
// Zod is the single source of truth here; the TypeScript types fall out of it.
//
// The criteria themselves live in criteria.md, not here, and are read at
// startup. Prose is the right shape for a rubric — it can carry the "why", and
// it can be edited by whoever owns the standard without touching the agent.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Scores are plain z.number(): Anthropic's structured output rejects
// minimum/maximum on an integer, so the 1-10 range is carried by the field
// description and by the system prompt instead of by the schema.
const score = (what: string) => z.number().describe(`${what} — scale 1-10, 1 = worst, 10 = best`);

export const REVIEW_SCHEMA = z.object({
  serverSideValidation: score("Criterion 1: server-side validation at the trust boundary"),
  dataAccess: score("Criterion 2: data access stays closed (RLS, immutability of approved quotes)"),
  patientPageLeaks: score("Criterion 3: the patient page leaks nothing"),
  testRiskCoverage: score("Criterion 4: tests proportional to risk"),
  codebaseFit: score("Criterion 5: fit with this codebase's conventions"),
  verdict: z
    .enum(["APPROVED", "NEEDS_ATTENTION", "REJECTED"])
    .describe(
      "APPROVED: nothing blocking, merge it. NEEDS_ATTENTION: mergeable, but a human should look at the findings first. " +
        "REJECTED: at least one finding is a real defect on a risky path and must be fixed before merge.",
    ),
  findings: z
    .array(
      z.object({
        criterion: z
          .enum(["serverSideValidation", "dataAccess", "patientPageLeaks", "testRiskCoverage", "codebaseFit"])
          .describe("Which criterion this finding is against"),
        severity: z
          .enum(["blocker", "major", "minor"])
          .describe("blocker forces REJECTED; major forces NEEDS_ATTENTION"),
        location: z.string().describe("File path, and a line or symbol when the diff shows one"),
        problem: z.string().describe("What is wrong, in one sentence, concretely enough to be checked"),
        suggestion: z.string().describe("What to do about it, in one sentence"),
      }),
    )
    .describe(
      "Three to five findings, most severe first. Report only what the diff shows; do not pad the list to reach three.",
    ),
  summary: z.string().describe("Two or three sentences in Markdown, written so the PR author can act on them"),
});

export type Review = z.infer<typeof REVIEW_SCHEMA>;

async function loadCriteria(): Promise<string> {
  return readFile(fileURLToPath(new URL("./criteria.md", import.meta.url)), "utf8");
}

export async function buildSystemPrompt(): Promise<string> {
  return `You are reviewing a pull request against DentiPlan, a dental treatment-quote app
(Astro SSR + React islands + Supabase + Cloudflare Workers). You are the first pass, not the last:
a human reads your verdict and decides.

Score the diff on the five criteria below, each 1-10, and give a verdict for the change as a whole.
Then list three to five findings, most severe first.

Judge only what the diff shows. If the change plainly does not touch a criterion, say so by scoring it
neutrally rather than inventing a problem — a padded finding costs the reviewer more than a missing one.
If the diff is truncated, say so in the summary and score what you can see.

${await loadCriteria()}`;
}
