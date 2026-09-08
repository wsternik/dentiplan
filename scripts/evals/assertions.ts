import { listGeneralItems, listToothItems } from "../../src/lib/pricing";
import { isValidToothNumber } from "../../src/lib/quote/tooth-name";
import { ParsedDiagnosisSchema, type ParsedDiagnosis } from "../../src/lib/llm/schema";

interface ExpectedTooth {
  number: number;
  treatmentType: ParsedDiagnosis["teeth"][number]["treatmentType"];
  urgency: ParsedDiagnosis["teeth"][number]["urgency"];
  urgencyFromNote: boolean;
  status: ParsedDiagnosis["teeth"][number]["status"];
  pricelistItemIds: string[];
}

export interface EvalExpectation {
  teeth: ExpectedTooth[];
  generalItems: { id: string; visitNumber: number }[];
  visitGroups: number[][];
  warningTokens: string[];
  forbiddenWarningTokens: string[];
  warningPolicy?: { type: "empty-or-token"; token: string };
}

export interface AtomResult {
  pass: boolean;
  score: number;
  reason: string;
}

export interface CaseGrade {
  pass: boolean;
  score: number;
  reason: string;
  componentResults: AtomResult[];
}

interface Check {
  id: string;
  safety: boolean;
  run: (parsed: ParsedDiagnosis) => { pass: boolean; detail?: string };
}

function canonical(values: unknown[]): string {
  return JSON.stringify([...values].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}

function duplicates<T>(values: T[]): T[] {
  const seen = new Set<T>();
  return values.filter((value) => (seen.has(value) ? true : !seen.add(value)));
}

function normalized(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("pl");
}

function result(check: Check, pass: boolean, detail?: string): AtomResult {
  const tag = check.safety ? "[safety]" : "[quality]";
  return {
    pass,
    score: pass ? 1 : 0,
    reason: `${tag} ${check.id}: ${pass ? "pass" : (detail ?? "failed")}`,
  };
}

function checksFor(expected: EvalExpectation): Check[] {
  const toothIds = new Set(listToothItems().map((item) => item.id));
  const generalIds = new Set(listGeneralItems().map((item) => item.id));
  const expectedNumbers = expected.teeth.map((tooth) => tooth.number);

  const checks: Check[] = [
    {
      id: "valid-fdi-and-catalog-ids",
      safety: true,
      run: (parsed) => {
        const badTeeth = parsed.teeth.filter((tooth) => !isValidToothNumber(tooth.number)).map((tooth) => tooth.number);
        const badToothIds = parsed.teeth.flatMap((tooth) => tooth.pricelistItemIds.filter((id) => !toothIds.has(id)));
        const badGeneralIds = parsed.generalItems.filter((item) => !generalIds.has(item.id)).map((item) => item.id);
        const invalid = [...badTeeth.map(String), ...badToothIds, ...badGeneralIds];
        return { pass: invalid.length === 0, detail: `invented domain values: ${invalid.join(", ")}` };
      },
    },
    {
      id: "unique-teeth",
      safety: true,
      run: (parsed) => {
        const found = duplicates(parsed.teeth.map((tooth) => tooth.number));
        return { pass: found.length === 0, detail: `duplicates: ${found.join(", ")}` };
      },
    },
    {
      id: "unique-visits",
      safety: true,
      run: (parsed) => {
        const found = duplicates(parsed.visits.map((visit) => visit.number));
        return { pass: found.length === 0, detail: `duplicates: ${found.join(", ")}` };
      },
    },
    {
      id: "unique-general-items",
      safety: true,
      run: (parsed) => {
        const found = duplicates(parsed.generalItems.map((item) => item.id));
        return { pass: found.length === 0, detail: `duplicates: ${found.join(", ")}` };
      },
    },
    {
      id: "unique-tooth-item-ids",
      safety: true,
      run: (parsed) => {
        const found = parsed.teeth.flatMap((tooth) =>
          duplicates(tooth.pricelistItemIds).map((id) => `${tooth.number}:${id}`),
        );
        return { pass: found.length === 0, detail: `duplicates: ${found.join(", ")}` };
      },
    },
    {
      id: "declared-visit-references",
      safety: true,
      run: (parsed) => {
        const declared = new Set(parsed.visits.map((visit) => visit.number));
        const orphaned = [
          ...parsed.teeth
            .filter((tooth) => tooth.visitNumber !== 0 && !declared.has(tooth.visitNumber))
            .map((tooth) => `tooth ${tooth.number}->${tooth.visitNumber}`),
          ...parsed.generalItems
            .filter((item) => item.visitNumber !== 0 && !declared.has(item.visitNumber))
            .map((item) => `${item.id}->${item.visitNumber}`),
        ];
        return { pass: orphaned.length === 0, detail: `orphaned references: ${orphaned.join(", ")}` };
      },
    },
    {
      id: "exact-tooth-set",
      safety: true,
      run: (parsed) => {
        const actual = parsed.teeth.map((tooth) => tooth.number);
        return {
          pass: canonical(actual) === canonical(expectedNumbers),
          detail: `expected ${canonical(expectedNumbers)}, received ${canonical(actual)}`,
        };
      },
    },
  ];

  for (const tooth of expected.teeth) {
    checks.push({
      id: `tooth-${tooth.number}`,
      safety: false,
      run: (parsed) => {
        const actual = parsed.teeth.find((candidate) => candidate.number === tooth.number);
        if (!actual) return { pass: false, detail: "missing" };
        const projected = {
          number: actual.number,
          treatmentType: actual.treatmentType,
          urgency: actual.urgency,
          urgencyFromNote: actual.urgencyFromNote,
          status: actual.status,
          pricelistItemIds: [...actual.pricelistItemIds].sort(),
        };
        const wanted = { ...tooth, pricelistItemIds: [...tooth.pricelistItemIds].sort() };
        return {
          pass: JSON.stringify(projected) === JSON.stringify(wanted),
          detail: `expected ${JSON.stringify(wanted)}, received ${JSON.stringify(projected)}`,
        };
      },
    });
  }

  checks.push(
    {
      id: "exact-general-items",
      safety: true,
      run: (parsed) => ({
        pass: canonical(parsed.generalItems) === canonical(expected.generalItems),
        detail: `expected ${canonical(expected.generalItems)}, received ${canonical(parsed.generalItems)}`,
      }),
    },
    {
      id: "canonical-visit-groups",
      safety: false,
      run: (parsed) => {
        const actual = parsed.visits.map((visit) =>
          parsed.teeth
            .filter((tooth) => tooth.visitNumber === visit.number)
            .map((tooth) => tooth.number)
            .sort((a, b) => a - b),
        );
        return {
          pass: canonical(actual) === canonical(expected.visitGroups.map((group) => [...group].sort((a, b) => a - b))),
          detail: `expected ${canonical(expected.visitGroups)}, received ${canonical(actual)}`,
        };
      },
    },
  );

  for (const token of expected.warningTokens) {
    checks.push({
      id: `warning-contains-${token}`,
      safety: true,
      run: (parsed) => {
        const joined = normalized(parsed.warnings.join("\n"));
        return { pass: joined.includes(normalized(token)), detail: `missing warning token ${JSON.stringify(token)}` };
      },
    });
  }
  for (const token of expected.forbiddenWarningTokens) {
    checks.push({
      id: `warning-omits-${token}`,
      safety: false,
      run: (parsed) => {
        const joined = normalized(parsed.warnings.join("\n"));
        return {
          pass: !joined.includes(normalized(token)),
          detail: `unexpected warning token ${JSON.stringify(token)}`,
        };
      },
    });
  }
  if (expected.warningPolicy) {
    const { token } = expected.warningPolicy;
    checks.push({
      id: "empty-or-noise-warning",
      safety: true,
      run: (parsed) => ({
        pass:
          parsed.warnings.length === 0 ||
          parsed.warnings.every((warning) => normalized(warning).includes(normalized(token))),
        detail: "warnings invented clinical content instead of preserving the noise",
      }),
    });
  }

  return checks;
}

export function gradeParsedDiagnosis(output: unknown, expected: EvalExpectation): CaseGrade {
  const checks = checksFor(expected);
  let decoded: unknown;
  try {
    decoded = typeof output === "string" ? JSON.parse(output) : output;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const components = [
      { pass: false, score: 0, reason: `[safety] wire-schema: invalid JSON (${detail})` },
      ...checks.map((check) => result(check, false, "not evaluated because wire schema failed")),
    ];
    return { pass: false, score: 0, reason: "Raw response is not valid JSON.", componentResults: components };
  }

  const parsed = ParsedDiagnosisSchema.safeParse(decoded);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    const components = [
      { pass: false, score: 0, reason: `[safety] wire-schema: ${detail}` },
      ...checks.map((check) => result(check, false, "not evaluated because wire schema failed")),
    ];
    return { pass: false, score: 0, reason: "Raw response fails ParsedDiagnosisSchema.", componentResults: components };
  }

  const components = [
    { pass: true, score: 1, reason: "[safety] wire-schema: pass" },
    ...checks.map((check) => {
      const checkResult = check.run(parsed.data);
      return result(check, checkResult.pass, checkResult.detail);
    }),
  ];
  const passed = components.filter((component) => component.pass).length;
  const failedReasons = components.filter((component) => !component.pass).map((component) => component.reason);
  return {
    pass: passed === components.length,
    score: passed / components.length,
    reason: failedReasons.length === 0 ? "All deterministic atoms passed." : failedReasons.join("; "),
    componentResults: components,
  };
}
