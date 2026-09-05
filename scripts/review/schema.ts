// The contract between the review agent and everything downstream of it.
//
// Structured output is the whole point: a free-text "opinion" is something a
// human skims, but a schema-validated object is something a workflow can key
// off — pick a label, decide whether to comment, count findings over time.
// Zod is the single source of truth here; the TypeScript types fall out of it.

import { z } from "zod";

export const CRITERIA = [
  "implementationCorrectness",
  "idiomaticity",
  "complexity",
  "testRiskCoverage",
  "securitySafety",
] as const;

// Scores are plain z.number(): Anthropic's structured output rejects
// minimum/maximum on an integer, so the 1-10 range is carried by the field
// description and the system prompt instead of by the schema.
const score = (what: string) => z.number().describe(`${what} (scale 1-10, 1 = seriously deficient, 10 = exemplary)`);

export const REVIEW_SCHEMA = z.object({
  implementationCorrectness: score(
    "Does the code do what it claims, on the happy path, at the edges, and in error handling",
  ),
  idiomaticity: score("Fit with the conventions of the language and of this project"),
  complexity: score("Simplicity of the solution relative to the problem it solves"),
  testRiskCoverage: score("Test coverage proportional to the risk of the paths being changed"),
  securitySafety: score("Absence of vulnerabilities and of leaked secrets"),
  verdict: z.enum(["pass", "fail"]).describe("Binding verdict for the change as a whole"),
  summary: z.string().describe("Two or three sentences in Markdown, written so the PR author can act on them"),
});

export type Review = z.infer<typeof REVIEW_SCHEMA>;

export const SYSTEM_PROMPT = `You are a precise, constructive code reviewer judging a pull request.
Score the diff you are given on five criteria, each on a 1-10 scale (1 = seriously deficient, 10 = exemplary):
implementation correctness, idiomaticity, complexity, test coverage relative to risk, and security.
Then issue a binding verdict (pass/fail) for the change as a whole and add a short summary
(two or three sentences, Markdown) the PR author can act on.

Judge only what the diff shows. If the diff is truncated, say so in the summary and score what you can see.`;
