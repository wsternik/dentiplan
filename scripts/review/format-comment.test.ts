// The comment is the only part of the pipeline a human reads, and it is built
// by one pure function from a validated object. A regression here — a missing
// criterion row, a finding rendered without its severity — would show up as a
// worse review rather than as a failure, so it is worth an assertion.

import { describe, expect, it } from "vitest";

import { render } from "./format-comment";
import { type Review } from "./schema";

const base: Review = {
  serverSideValidation: 8,
  dataAccess: 5,
  patientPageLeaks: 10,
  testRiskCoverage: 3,
  codebaseFit: 7,
  verdict: "NEEDS_ATTENTION",
  findings: [],
  summary: "Two write paths changed; the second one is unguarded.",
};

const finding = {
  criterion: "serverSideValidation",
  severity: "blocker",
  location: "src/pages/api/quotes.ts:42",
  problem: "The payload reaches the database without a schema parse.",
  suggestion: "Parse the body with the existing Zod contract before the insert.",
} as const;

describe("render", () => {
  it("opens with the verdict badge and the summary", () => {
    const markdown = render(base);

    expect(markdown.startsWith("## ⚠️ **NEEDS ATTENTION**")).toBe(true);
    expect(markdown).toContain(base.summary);
  });

  it("renders the badge for each verdict", () => {
    expect(render({ ...base, verdict: "APPROVED" })).toContain("✅ **APPROVED**");
    expect(render({ ...base, verdict: "REJECTED" })).toContain("🛑 **REJECTED**");
  });

  it("scores all five criteria by their human labels", () => {
    const markdown = render(base);

    expect(markdown).toContain("| Server-side validation at the trust boundary | 8/10 |");
    expect(markdown).toContain("| Data access stays closed | 5/10 |");
    expect(markdown).toContain("| The patient page leaks nothing | 10/10 |");
    expect(markdown).toContain("| Tests proportional to risk | 3/10 |");
    expect(markdown).toContain("| Fit with this codebase | 7/10 |");
  });

  it("says so when there are no findings", () => {
    expect(render(base)).toContain("_No findings._");
  });

  it("numbers findings and badges their severity", () => {
    const markdown = render({
      ...base,
      findings: [
        finding,
        { ...finding, severity: "major", criterion: "codebaseFit" },
        { ...finding, severity: "minor" },
      ],
    });

    expect(markdown).toContain("**1. 🛑 blocker — Server-side validation at the trust boundary**");
    expect(markdown).toContain("**2. ⚠️ major — Fit with this codebase**");
    expect(markdown).toContain("**3. · minor — Server-side validation at the trust boundary**");
    expect(markdown).not.toContain("_No findings._");
  });

  it("carries a finding's location, problem and suggestion", () => {
    const markdown = render({ ...base, findings: [finding] });

    expect(markdown).toContain(`\`${finding.location}\``);
    expect(markdown).toContain(finding.problem);
    expect(markdown).toContain(`> ${finding.suggestion}`);
  });

  it("closes with the advisory footer", () => {
    expect(render(base)).toContain("Advisory only — it does not gate the merge");
  });
});
