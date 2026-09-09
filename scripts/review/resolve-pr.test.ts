// The workflow's "Resolve the pull request under review" step decides what the
// agent looks at and — on the manual path — whether a fork's code is allowed to
// run in a job that holds this repository's secrets. That is shell, not
// TypeScript, so the test runs the step's own script out of the workflow file
// against a stubbed `gh`. Extracting it from the YAML rather than copying it
// here is the point: a future edit that weakens the fork check is edited into
// the file under test.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/review.yml"), "utf8");

// The step is identified by its id, and its script is the `run: |` block that
// follows, up to the next step in the list.
function resolveStepScript(): string {
  const step = workflow.slice(
    workflow.indexOf("        id: pr\n"),
    workflow.indexOf("      - uses: actions/checkout@v4"),
  );
  const body = step.slice(step.indexOf("        run: |\n") + "        run: |\n".length);
  return body
    .split("\n")
    .map((line) => line.replace(/^ {10}/, ""))
    .join("\n");
}

const hasJq = (() => {
  try {
    execFileSync("which", ["jq"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

interface Run {
  stdout: string;
  outputs: string;
}

// Runs the step's script with `gh` stubbed out, the way the runner would run
// it: environment in, $GITHUB_OUTPUT out.
function runStep(env: Record<string, string>, ghPayload: string): Run {
  const dir = mkdtempSync(join(tmpdir(), "resolve-pr-"));
  const script = join(dir, "step.sh");
  const outputs = join(dir, "outputs");
  const stub = join(dir, "gh");

  writeFileSync(script, resolveStepScript());
  writeFileSync(outputs, "");
  writeFileSync(stub, `#!/bin/bash\ncat <<'JSON'\n${ghPayload}\nJSON\n`);
  chmodSync(stub, 0o755);

  const stdout = execFileSync("bash", [script], {
    encoding: "utf8",
    env: {
      PATH: `${dir}:${process.env.PATH ?? ""}`,
      GITHUB_OUTPUT: outputs,
      EVENT_NUMBER: "",
      EVENT_BASE: "",
      EVENT_HEAD_SHA: "",
      INPUT_NUMBER: "",
      ...env,
    },
  });

  return { stdout, outputs: readFileSync(outputs, "utf8") };
}

const sameRepo = '{"number":18,"baseRefName":"release/1.x","headRefOid":"cafebabe","isCrossRepository":false}';
const fork = '{"number":77,"baseRefName":"main","headRefOid":"deadbeef","isCrossRepository":true}';

describe.skipIf(!hasJq)("the resolve step of the AI review workflow", () => {
  it("takes the pull request from the event payload on an automatic run", () => {
    const { outputs } = runStep(
      { EVENT_NAME: "pull_request", EVENT_NUMBER: "12", EVENT_BASE: "main", EVENT_HEAD_SHA: "abc123" },
      // A `pull_request` run must not consult gh at all; a payload that would
      // contradict the event is the way to notice if it starts to.
      fork,
    );

    expect(outputs).toContain("number=12");
    expect(outputs).toContain("base=main");
    expect(outputs).toContain("head_sha=abc123");
  });

  it("resolves the dispatched pull request, base branch included", () => {
    const { stdout, outputs } = runStep({ EVENT_NAME: "workflow_dispatch", INPUT_NUMBER: "18" }, sameRepo);

    expect(outputs).toContain("number=18");
    // Not main: the diff has to follow the pull request's own base.
    expect(outputs).toContain("base=release/1.x");
    expect(outputs).toContain("head_sha=cafebabe");
    expect(stdout).toContain("#18");
  });

  it("refuses a dispatch on a fork's pull request instead of running with secrets", () => {
    expect(() => runStep({ EVENT_NAME: "workflow_dispatch", INPUT_NUMBER: "77" }, fork)).toThrow();

    let failure: { status?: number; stdout?: string } = {};
    try {
      runStep({ EVENT_NAME: "workflow_dispatch", INPUT_NUMBER: "77" }, fork);
    } catch (error) {
      failure = error as { status?: number; stdout?: string };
    }

    expect(failure.status).toBe(1);
    expect(failure.stdout).toContain("::error::");
    expect(failure.stdout).toContain("fork");
  });
});
