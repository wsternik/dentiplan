// The two pure helpers the agent wraps around the model call. Neither needs a
// model: truncation is arithmetic on a string, and clamping is the only thing
// standing between an out-of-range score and the pull request comment, because
// the schema cannot express the 1-10 range.

import { describe, expect, it } from "vitest";

import { MAX_DIFF_CHARS, clampScores, truncate } from "./agent";
import { CRITERION_KEYS, type Review } from "./schema";

const review: Review = {
  serverSideValidation: 8,
  dataAccess: 7,
  patientPageLeaks: 9,
  testRiskCoverage: 6,
  codebaseFit: 7,
  verdict: "NEEDS_ATTENTION",
  findings: [
    {
      criterion: "dataAccess",
      severity: "major",
      location: "src/pages/api/quotes.ts:42",
      problem: "The update path trusts the client's quote id.",
      suggestion: "Scope the update by the session's operator id.",
    },
  ],
  summary: "One real finding on the write path.",
};

describe("truncate", () => {
  it("leaves a diff at or below the limit alone", () => {
    const diff = "a".repeat(MAX_DIFF_CHARS);
    expect(truncate(diff)).toEqual({ diff, truncated: false });
  });

  it("cuts a longer diff at the limit and says so in the text", () => {
    const result = truncate("b".repeat(MAX_DIFF_CHARS + 1));

    expect(result.truncated).toBe(true);
    expect(result.diff).toContain(`[diff truncated at ${MAX_DIFF_CHARS.toString()} characters]`);
    expect(result.diff.slice(0, MAX_DIFF_CHARS)).toBe("b".repeat(MAX_DIFF_CHARS));
    // The marker is appended, so the string grows; what matters is that the
    // model sees only the first MAX_DIFF_CHARS characters of the diff itself.
    expect(result.diff.slice(MAX_DIFF_CHARS)).not.toContain("b");
  });

  it("keeps an empty diff empty", () => {
    expect(truncate("")).toEqual({ diff: "", truncated: false });
  });
});

describe("clampScores", () => {
  it("passes in-range integer scores through unchanged", () => {
    expect(clampScores(review)).toEqual(review);
  });

  it("pulls scores back inside 1-10", () => {
    const clamped = clampScores({ ...review, serverSideValidation: 42, dataAccess: -3, patientPageLeaks: 0 });

    expect(clamped.serverSideValidation).toBe(10);
    expect(clamped.dataAccess).toBe(1);
    expect(clamped.patientPageLeaks).toBe(1);
  });

  it("rounds fractional scores to whole numbers", () => {
    const clamped = clampScores({ ...review, testRiskCoverage: 6.4, codebaseFit: 6.5 });

    expect(clamped.testRiskCoverage).toBe(6);
    expect(clamped.codebaseFit).toBe(7);
  });

  it("touches every criterion and nothing else", () => {
    const clamped = clampScores({ ...review, ...Object.fromEntries(CRITERION_KEYS.map((key) => [key, 99])) });

    for (const key of CRITERION_KEYS) expect(clamped[key]).toBe(10);
    expect(clamped.verdict).toBe(review.verdict);
    expect(clamped.findings).toEqual(review.findings);
    expect(clamped.summary).toBe(review.summary);
  });

  it("does not mutate the review it was given", () => {
    const input = { ...review, serverSideValidation: 42 };
    clampScores(input);
    expect(input.serverSideValidation).toBe(42);
  });
});
