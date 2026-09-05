/* eslint-disable no-console -- this is a CLI: stdout IS its output */
// Turns the agent's JSON verdict into the Markdown that lands on the pull
// request. Kept separate from agent.ts so the agent's stdout stays machine
// readable — the workflow pipes one into the other, and anything else that
// wants the raw scores still gets them.
//
//   npm run review -- --diff d.patch | npx tsx scripts/review/format-comment.ts

import { CRITERION_KEYS, REVIEW_SCHEMA, type CriterionKey, type Review } from "./schema.ts";

const CRITERION_LABELS: Record<CriterionKey, string> = {
  serverSideValidation: "Server-side validation at the trust boundary",
  dataAccess: "Data access stays closed",
  patientPageLeaks: "The patient page leaks nothing",
  testRiskCoverage: "Tests proportional to risk",
  codebaseFit: "Fit with this codebase",
};

const VERDICT_BADGE = {
  APPROVED: "✅ **APPROVED**",
  NEEDS_ATTENTION: "⚠️ **NEEDS ATTENTION**",
  REJECTED: "🛑 **REJECTED**",
} as const;

const SEVERITY_BADGE = { blocker: "🛑 blocker", major: "⚠️ major", minor: "· minor" } as const;

function render(review: Review): string {
  const scores = CRITERION_KEYS.map((key) => `| ${CRITERION_LABELS[key]} | ${review[key].toString()}/10 |`).join("\n");

  const findings =
    review.findings.length === 0
      ? "_No findings._"
      : review.findings
          .map(
            (f, i) =>
              `**${String(i + 1)}. ${SEVERITY_BADGE[f.severity]} — ${CRITERION_LABELS[f.criterion]}**\n` +
              `\`${f.location}\`\n\n` +
              `${f.problem}\n\n` +
              `> ${f.suggestion}`,
          )
          .join("\n\n");

  return [
    `## ${VERDICT_BADGE[review.verdict]}`,
    "",
    review.summary,
    "",
    "| Criterion | Score |",
    "| --- | --- |",
    scores,
    "",
    "### Findings",
    "",
    findings,
    "",
    "---",
    "",
    "<sub>First pass by the review agent in `scripts/review/`, judged against the five criteria in " +
      "`scripts/review/criteria.md`. Advisory only — it does not gate the merge, and a human has the last word.</sub>",
  ].join("\n");
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const parsed = REVIEW_SCHEMA.safeParse(JSON.parse(await readStdin()));
if (!parsed.success) {
  console.error(`Not a valid review object: ${parsed.error.message}`);
  process.exit(1);
}
console.log(render(parsed.data));
