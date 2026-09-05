/* eslint-disable no-console -- this is a CLI: stdout IS its output */
// A code review agent assembled from the Vercel AI SDK.
//
// Reads a unified diff (stdin, or --diff <path>) and prints one schema-valid
// JSON object to stdout. Nothing else goes to stdout, so callers can pipe it
// straight into jq; diagnostics go to stderr.
//
//   git diff origin/main...HEAD -- src/ | npm run review
//   npm run review -- --diff scripts/review/fixtures/sample.diff
//
// There is no tool loop on purpose. The agent gets the diff and returns a
// judgement — it reads no files, calls no services, and changes no state, so a
// single generateText call with a structured output is the whole harness.

import { readFile } from "node:fs/promises";
import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { REVIEW_SCHEMA, SYSTEM_PROMPT, type Review } from "./schema.ts";

const MODEL = "claude-sonnet-5";

// A large diff costs tokens and buys nothing: past a point the model is
// skimming, and the verdict gets vaguer rather than sharper. Callers should
// narrow the diff by path first; this is the backstop for when they don't.
const MAX_DIFF_CHARS = 120_000;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function readDiff(): Promise<string> {
  const flagIndex = process.argv.indexOf("--diff");
  if (flagIndex !== -1) {
    const path = process.argv[flagIndex + 1];
    if (!path) throw new Error("--diff needs a file path");
    return readFile(path, "utf8");
  }
  if (process.stdin.isTTY) {
    throw new Error("No diff on stdin. Pipe one in, or pass --diff <path>.");
  }
  return readStdin();
}

function truncate(diff: string): { diff: string; truncated: boolean } {
  if (diff.length <= MAX_DIFF_CHARS) return { diff, truncated: false };
  return {
    diff: `${diff.slice(0, MAX_DIFF_CHARS)}\n\n[diff truncated at ${MAX_DIFF_CHARS} characters]`,
    truncated: true,
  };
}

export async function review(rawDiff: string): Promise<Review> {
  const { diff, truncated } = truncate(rawDiff);
  if (truncated) {
    console.error(`warning: diff truncated to ${MAX_DIFF_CHARS} characters (was ${rawDiff.length})`);
  }

  const { output, usage } = await generateText({
    model: anthropic(MODEL),
    system: SYSTEM_PROMPT,
    output: Output.object({ schema: REVIEW_SCHEMA }),
    prompt: `Review this diff:\n\n${diff}`,
  });

  console.error(`tokens: ${usage.inputTokens} in, ${usage.outputTokens} out`);
  return output;
}

const diff = await readDiff();
if (diff.trim().length === 0) {
  console.error("Empty diff — nothing to review.");
  process.exit(0);
}
console.log(JSON.stringify(await review(diff), null, 2));
