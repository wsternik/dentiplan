import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface Metadata {
  preparedAt: string;
  nodeVersion: string;
  gitSha: string;
  gitDirty: false;
  corpus: { id: string; sha256: string }[];
  prompts: { id: string; label: string; sha256: string }[];
  providers: { id: string; label: string; effort: string | null; maxTokens: number; maxRetries: number }[];
  sourceFiles: { file: string; sha256: string }[];
  providerSchemaSha256: string;
  timeoutMs: number;
  cache: boolean;
}

interface ComponentResult {
  pass?: boolean;
  reason?: string;
  componentResults?: ComponentResult[];
}

interface ResultRow {
  error?: string;
  success?: boolean;
  cost?: number;
  latencyMs?: number;
  prompt?: { label?: string };
  provider?: string | { id?: string; label?: string };
  tokenUsage?: { prompt?: number; completion?: number; total?: number };
  vars?: { caseId?: string };
  testCase?: { vars?: { caseId?: string } };
  gradingResult?: ComponentResult | null;
  response?: { error?: string };
}

interface EvalDocument {
  results?: { version?: number; timestamp?: string; results?: ResultRow[]; outputs?: ResultRow[] };
}

export interface CellSummary {
  prompt: string;
  provider: string;
  casesPassed: number;
  caseCount: number;
  macroPassRate: number;
  atomsPassed: number;
  atomCount: number;
  microPassRate: number;
  safetyEligible: boolean;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  medianInputTokens: number;
  medianOutputTokens: number;
  medianTotalTokens: number;
  totalCostUsd: number;
  costPerCaseUsd: number;
  medianLatencyMs: number;
  p95LatencyMs: number;
  failures: { caseId: string; reasons: string[] }[];
}

export interface EvalSummary {
  schemaVersion: 1;
  evaluatedAt: string;
  prepared: Metadata;
  callCount: number;
  cells: CellSummary[];
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * fraction) - 1] ?? 0;
}

function leaves(result: ComponentResult | null | undefined): ComponentResult[] {
  if (!result) return [];
  if (result.componentResults?.length) {
    const flattened = result.componentResults.flatMap(leaves);
    return [
      ...new Map(
        flattened.map((component) => [`${String(component.pass)}\u0000${component.reason ?? ""}`, component]),
      ).values(),
    ];
  }
  return [result];
}

function providerId(provider: ResultRow["provider"]): string {
  if (typeof provider === "string") return provider;
  return provider?.id ?? "";
}

function rowCaseId(row: ResultRow): string {
  return row.vars?.caseId ?? row.testCase?.vars?.caseId ?? "";
}

function requireTelemetry(row: ResultRow, tuple: string): void {
  const values = {
    cost: row.cost,
    latencyMs: row.latencyMs,
    promptTokens: row.tokenUsage?.prompt,
    completionTokens: row.tokenUsage?.completion,
    totalTokens: row.tokenUsage?.total,
  };
  const invalid = Object.entries(values)
    .filter(([, value]) => typeof value !== "number" || !Number.isFinite(value) || value < 0)
    .map(([field]) => field);
  if (invalid.length > 0) {
    throw new Error(`${tuple} has missing or invalid telemetry: ${invalid.join(", ")}.`);
  }
}

export function summarizeEval(document: EvalDocument, metadata: Metadata): EvalSummary {
  const rows = document.results?.results ?? document.results?.outputs;
  if (!Array.isArray(rows)) throw new Error("Promptfoo export has no results rows.");
  if (document.results?.version !== 3) {
    throw new Error(`Unsupported Promptfoo export version: ${String(document.results?.version)}.`);
  }

  const expectedCalls = metadata.corpus.length * metadata.prompts.length * metadata.providers.length;
  if (rows.length !== expectedCalls) {
    throw new Error(`Expected ${expectedCalls} matrix rows; received ${rows.length}.`);
  }
  const errors = rows.filter((row) => {
    if (row.response?.error) return true;
    return !row.gradingResult;
  });
  if (errors.length > 0) throw new Error(`Promptfoo export contains ${errors.length} provider error(s).`);

  const expectedTuples = new Set(
    metadata.prompts.flatMap((prompt) =>
      metadata.providers.flatMap((provider) =>
        metadata.corpus.map((testCase) => `${prompt.label}\u0000${provider.id}\u0000${testCase.id}`),
      ),
    ),
  );
  const actualTuples = new Map<string, number>();
  for (const row of rows) {
    const prompt = row.prompt?.label ?? "";
    const provider = providerId(row.provider);
    const caseId = rowCaseId(row);
    const tuple = `${prompt}\u0000${provider}\u0000${caseId}`;
    if (!expectedTuples.has(tuple)) {
      throw new Error(`Unexpected matrix tuple: ${JSON.stringify({ prompt, provider, caseId })}.`);
    }
    actualTuples.set(tuple, (actualTuples.get(tuple) ?? 0) + 1);
    requireTelemetry(row, `${prompt}/${provider}/${caseId}`);
    if (typeof row.success !== "boolean") throw new Error(`${prompt}/${provider}/${caseId} has no success flag.`);
  }
  const duplicateTuples = [...actualTuples].filter(([, count]) => count !== 1).map(([tuple]) => tuple);
  const missingTuples = [...expectedTuples].filter((tuple) => !actualTuples.has(tuple));
  if (duplicateTuples.length > 0 || missingTuples.length > 0) {
    throw new Error(`Matrix tuple mismatch: ${duplicateTuples.length} duplicate(s), ${missingTuples.length} missing.`);
  }

  const grouped = new Map<string, ResultRow[]>();
  for (const row of rows) {
    const prompt = row.prompt?.label ?? "";
    const provider = providerId(row.provider);
    const key = `${prompt}\u0000${provider}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  const expectedCells = metadata.prompts.length * metadata.providers.length;
  if (grouped.size !== expectedCells) {
    throw new Error(`Expected ${expectedCells} prompt/provider cells; received ${grouped.size}.`);
  }

  const cells = [...grouped.entries()]
    .map(([key, cellRows]): CellSummary => {
      const [prompt, provider] = key.split("\u0000");
      if (cellRows.length !== metadata.corpus.length) {
        throw new Error(`${prompt}/${provider} has ${cellRows.length} rows; expected ${metadata.corpus.length}.`);
      }

      const atoms = cellRows.flatMap((row) => leaves(row.gradingResult));
      if (atoms.length === 0) throw new Error(`${prompt}/${provider} has no deterministic atom results.`);
      const safetyAtoms = atoms.filter((atom) => atom.reason?.startsWith("[safety]"));
      if (safetyAtoms.length === 0) throw new Error(`${prompt}/${provider} has no safety atoms.`);

      const failures = cellRows.flatMap((row) => {
        const reasons = leaves(row.gradingResult)
          .filter((atom) => atom.pass === false)
          .map((atom) => atom.reason ?? "Unnamed deterministic atom failed.");
        if (reasons.length === 0) return [];
        const caseId = row.vars?.caseId ?? row.testCase?.vars?.caseId;
        if (!caseId) throw new Error("A failed result row has no caseId.");
        return [{ caseId, reasons }];
      });
      const inputTokens = cellRows.reduce((sum, row) => sum + (row.tokenUsage?.prompt ?? 0), 0);
      const outputTokens = cellRows.reduce((sum, row) => sum + (row.tokenUsage?.completion ?? 0), 0);
      const totalTokens = cellRows.reduce(
        (sum, row) =>
          sum + (row.tokenUsage?.total ?? (row.tokenUsage?.prompt ?? 0) + (row.tokenUsage?.completion ?? 0)),
        0,
      );
      const totalCostUsd = cellRows.reduce((sum, row) => sum + (row.cost ?? 0), 0);
      const latencies = cellRows.map((row) => row.latencyMs ?? 0);
      const inputTokenCounts = cellRows.map((row) => row.tokenUsage?.prompt ?? 0);
      const outputTokenCounts = cellRows.map((row) => row.tokenUsage?.completion ?? 0);
      const totalTokenCounts = cellRows.map((row) => row.tokenUsage?.total ?? 0);
      const atomsPassed = atoms.filter((atom) => atom.pass === true).length;

      return {
        prompt,
        provider,
        casesPassed: cellRows.filter((row) => row.success === true).length,
        caseCount: cellRows.length,
        macroPassRate: cellRows.filter((row) => row.success === true).length / cellRows.length,
        atomsPassed,
        atomCount: atoms.length,
        microPassRate: atomsPassed / atoms.length,
        safetyEligible: safetyAtoms.every((atom) => atom.pass === true),
        inputTokens,
        outputTokens,
        totalTokens,
        medianInputTokens: percentile(inputTokenCounts, 0.5),
        medianOutputTokens: percentile(outputTokenCounts, 0.5),
        medianTotalTokens: percentile(totalTokenCounts, 0.5),
        totalCostUsd,
        costPerCaseUsd: totalCostUsd / cellRows.length,
        medianLatencyMs: percentile(latencies, 0.5),
        p95LatencyMs: percentile(latencies, 0.95),
        failures,
      };
    })
    .sort((a, b) => `${a.prompt}/${a.provider}`.localeCompare(`${b.prompt}/${b.provider}`));

  return {
    schemaVersion: 1,
    evaluatedAt: document.results.timestamp ?? new Date(0).toISOString(),
    prepared: metadata,
    callCount: rows.length,
    cells,
  };
}

function main(): void {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: summarize-prefill.ts <promptfoo-result.json>");
  const here = dirname(fileURLToPath(import.meta.url));
  const generatedDir = resolve(here, "../../evals/prefill/.generated");
  const document = JSON.parse(readFileSync(resolve(input), "utf8")) as EvalDocument;
  const metadata = JSON.parse(readFileSync(resolve(generatedDir, "metadata.json"), "utf8")) as Metadata;
  const summary = summarizeEval(document, metadata);
  const output = resolve(generatedDir, "summary.json");
  writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`);
  // eslint-disable-next-line no-console -- command-line success signal
  console.log(`Summarized ${summary.callCount} calls across ${summary.cells.length} prompt/model cells.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
