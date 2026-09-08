import { gradeParsedDiagnosis } from "../../scripts/evals/assertions.ts";

export default function assertPrefill(output, context) {
  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- Promptfoo's callback boundary is untyped. */
  const expected =
    typeof context.vars.expected === "string" ? JSON.parse(context.vars.expected) : context.vars.expected;
  const grade = gradeParsedDiagnosis(output, expected);
  /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
  return grade;
}
