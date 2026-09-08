import { describe, expect, it } from "vitest";

import { summarizeEval } from "./summarize-prefill";

const metadata = {
  preparedAt: "2026-09-08T12:00:00.000Z",
  nodeVersion: "22.14.0",
  gitSha: "abc123",
  corpus: [
    { id: "one", sha256: "1" },
    { id: "two", sha256: "2" },
  ],
  prompts: [{ id: "polish-production", sha256: "prompt" }],
  providers: [
    { id: "sonnet", effort: "medium", maxTokens: 128_000, maxRetries: 1 },
    { id: "haiku", effort: null, maxTokens: 64_000, maxRetries: 1 },
  ],
  timeoutMs: 45_000,
  cache: false,
};

interface TestComponent {
  pass: boolean;
  score?: number;
  reason?: string;
  componentResults?: TestComponent[];
}

function row(provider: string, caseId: string, pass: boolean, latencyMs: number) {
  const componentResults: TestComponent[] = [
    { pass: true, score: 1, reason: "[safety] wire-schema: pass" },
    { pass, score: pass ? 1 : 0, reason: `[quality] tooth: ${pass ? "pass" : "failed"}` },
  ];
  return {
    success: pass,
    cost: provider === "sonnet" ? 0.02 : 0.01,
    latencyMs,
    prompt: { label: "Polish production" },
    provider: { id: provider },
    tokenUsage: { prompt: 100, completion: 20, total: 120 },
    vars: { caseId },
    gradingResult: {
      componentResults,
    },
  };
}

describe("summarizeEval", () => {
  it("aggregates macro, micro, token, cost and latency metrics by cell", () => {
    const summary = summarizeEval(
      {
        results: {
          version: 3,
          timestamp: "2026-09-08T13:00:00.000Z",
          results: [
            row("sonnet", "one", true, 100),
            row("sonnet", "two", false, 300),
            row("haiku", "one", true, 50),
            row("haiku", "two", true, 70),
          ],
        },
      },
      metadata,
    );

    expect(summary.callCount).toBe(4);
    const sonnet = summary.cells.find((cell) => cell.provider === "sonnet");
    expect(sonnet).toMatchObject({
      casesPassed: 1,
      caseCount: 2,
      macroPassRate: 0.5,
      atomsPassed: 3,
      atomCount: 4,
      microPassRate: 0.75,
      safetyEligible: true,
      inputTokens: 200,
      outputTokens: 40,
      totalTokens: 240,
      totalCostUsd: 0.04,
      costPerCaseUsd: 0.02,
      medianLatencyMs: 100,
      p95LatencyMs: 300,
    });
    expect(sonnet?.failures).toEqual([{ caseId: "two", reasons: ["[quality] tooth: failed"] }]);
  });

  it("rejects an unexpected matrix shape", () => {
    expect(() =>
      summarizeEval({ results: { version: 3, results: [row("sonnet", "one", true, 100)] } }, metadata),
    ).toThrow("Expected 4 matrix rows");
  });

  it("rejects provider errors instead of reporting them as model failures", () => {
    const rows = [
      { ...row("sonnet", "one", true, 100), response: { error: "network" } },
      row("sonnet", "two", true, 100),
      row("haiku", "one", true, 100),
      row("haiku", "two", true, 100),
    ];
    expect(() => summarizeEval({ results: { version: 3, results: rows } }, metadata)).toThrow("provider error");
  });

  it("counts Promptfoo's nested and flattened component copies once", () => {
    const wrapped = row("sonnet", "one", false, 100);
    const atoms = wrapped.gradingResult.componentResults;
    wrapped.gradingResult.componentResults = [{ pass: false, componentResults: atoms }, ...atoms];

    const summary = summarizeEval(
      {
        results: {
          version: 3,
          results: [
            wrapped,
            row("sonnet", "two", true, 100),
            row("haiku", "one", true, 100),
            row("haiku", "two", true, 100),
          ],
        },
      },
      metadata,
    );

    expect(summary.cells.find((cell) => cell.provider === "sonnet")).toMatchObject({
      atomsPassed: 3,
      atomCount: 4,
      microPassRate: 0.75,
      failures: [{ caseId: "one", reasons: ["[quality] tooth: failed"] }],
    });
  });
});
