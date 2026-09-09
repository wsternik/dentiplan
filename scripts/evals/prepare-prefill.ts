import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { ParsedDiagnosisSchema } from "../../src/lib/llm/schema";
import { buildInstructions } from "../../src/lib/llm/prompt";
import { sanitizeAnthropicSchema } from "./anthropic-schema";
import { buildEnglishInstructions } from "./english-prompt";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const casesDir = resolve(root, "evals/prefill/cases");
const generatedDir = resolve(root, "evals/prefill/.generated");
const sourceFiles = [
  "evals/prefill/promptfooconfig.yaml",
  "evals/prefill/assertions.mjs",
  "evals/prefill/prompts/production.mjs",
  "evals/prefill/prompts/english.mjs",
  "scripts/evals/assertions.ts",
  "scripts/evals/anthropic-schema.ts",
  "scripts/evals/english-prompt.ts",
  "scripts/evals/prepare-prefill.ts",
  "scripts/evals/summarize-prefill.ts",
  "src/lib/llm/prompt.ts",
  "src/lib/llm/schema.ts",
] as const;

const ExpectedToothSchema = z.object({
  number: z.number().int(),
  treatmentType: z.enum(["extraction", "root-canal", "caries-removal", "filling", "other", "unknown"]),
  urgency: z.enum(["urgent", "moderate", "mild", "unknown"]),
  urgencyFromNote: z.boolean(),
  status: z.enum(["in-plan", "uncertain", "out-of-current-plan"]),
  pricelistItemIds: z.array(z.string()),
});

const EvalCaseSchema = z.object({
  description: z.string().min(1),
  vars: z.object({
    caseId: z.string().regex(/^[a-z0-9-]+$/),
    note: z.string(),
    expected: z.object({
      teeth: z.array(ExpectedToothSchema),
      generalItems: z.array(z.object({ id: z.string(), visitNumber: z.number().int() })),
      visitGroups: z.array(z.array(z.number().int())),
      warningTokens: z.array(z.string()).default([]),
      forbiddenWarningTokens: z.array(z.string()).default([]),
      warningPolicy: z.object({ type: z.literal("empty-or-token"), token: z.string().min(1) }).optional(),
    }),
  }),
});

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function main(): void {
  if (Number(process.versions.node.split(".")[0]) !== 22) {
    throw new Error(`Prompt eval preparation requires Node 22; received ${process.versions.node}.`);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required for the paid prompt evaluation.");
  }

  const files = readdirSync(casesDir)
    .filter((file) => file.endsWith(".json"))
    .sort();
  if (files.length !== 8) throw new Error(`Expected exactly 8 baseline cases; found ${files.length}.`);

  const cases = files.map((file) => {
    const raw = readFileSync(resolve(casesDir, file), "utf8");
    const decoded: unknown = JSON.parse(raw);
    if (!Array.isArray(decoded) || decoded.length !== 1) {
      throw new Error(`${file} must contain exactly one test case.`);
    }
    return { file, raw, parsed: EvalCaseSchema.parse(decoded[0]) };
  });
  const ids = cases.map(({ parsed }) => parsed.vars.caseId);
  if (new Set(ids).size !== ids.length) throw new Error("Every prompt-eval caseId must be unique.");

  const productionPrompt = buildInstructions();
  const englishPrompt = buildEnglishInstructions();
  const providerSchema = sanitizeAnthropicSchema(z.toJSONSchema(ParsedDiagnosisSchema));
  const gitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const gitStatus = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  if (gitStatus) {
    throw new Error("Commit the prompt-eval harness and start from a clean worktree before a paid run.");
  }

  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(resolve(generatedDir, "anthropic-schema.json"), `${JSON.stringify(providerSchema, null, 2)}\n`);
  writeFileSync(
    resolve(generatedDir, "metadata.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        preparedAt: new Date().toISOString(),
        nodeVersion: process.versions.node,
        gitSha,
        gitDirty: false,
        corpus: cases.map(({ file, raw, parsed }) => ({ file, id: parsed.vars.caseId, sha256: sha256(raw) })),
        prompts: [
          { id: "polish-production", label: "Polish production", sha256: sha256(productionPrompt) },
          { id: "english-candidate", label: "English candidate", sha256: sha256(englishPrompt) },
        ],
        providers: [
          {
            id: "anthropic:messages:claude-sonnet-5",
            label: "Sonnet 5 · medium effort",
            effort: "medium",
            thinking: "adaptive",
            maxTokens: 128_000,
            maxRetries: 1,
            inputUsdPerMillion: 2,
            outputUsdPerMillion: 10,
          },
          {
            id: "anthropic:messages:claude-haiku-4-5",
            label: "Haiku 4.5 · no effort option",
            effort: null,
            thinking: null,
            maxTokens: 64_000,
            maxRetries: 1,
            inputUsdPerMillion: 1,
            outputUsdPerMillion: 5,
          },
        ],
        pricingAsOf: "2026-09-09",
        pricingSource: "https://platform.claude.com/docs/en/about-claude/pricing",
        sourceFiles: sourceFiles.map((file) => ({
          file,
          sha256: sha256(readFileSync(resolve(root, file), "utf8")),
        })),
        providerSchemaSha256: sha256(JSON.stringify(providerSchema)),
        timeoutMs: 45_000,
        cache: false,
      },
      null,
      2,
    )}\n`,
  );

  // eslint-disable-next-line no-console -- command-line success signal
  console.log(`Prepared ${cases.length} synthetic cases and two prompt variants under Node ${process.versions.node}.`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-console -- command-line failure signal
  console.error(`Prefill eval preparation failed: ${message}`);
  process.exitCode = 1;
}
