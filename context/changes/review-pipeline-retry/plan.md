# Manual re-review and review helper tests

## Current State Analysis

- `.github/workflows/review.yml` declares `workflow_dispatch:` with no inputs. A dispatch checks out the selected branch, so `git diff origin/main...HEAD` on `main` yields zero bytes and the run stops at "nothing to review". Even with a branch that has commits, the comment step is gated on `github.event_name == 'pull_request'` and has no `github.event.pull_request.number` to post to. The trigger therefore promises an on-demand review of a pull request and delivers none.
- `truncate()` and `clampScores()` (`scripts/review/agent.ts`) and `render()` (`scripts/review/format-comment.ts`) are pure, module-private, and untested. Both modules execute their CLI at import time, so a test cannot import them without running the CLI. The archived implementation review of the pipeline recorded exactly this as its one open follow-up.

## Desired End State

Dispatching "AI review" with a pull request number reviews that pull request against its own base and comments on it, the same way an automatic run does; a fork pull request is refused with a readable error instead of being handed secrets. The three pure helpers are exported and covered by tests that call no model, while both CLIs keep their current behaviour when executed directly.

## What We're NOT Doing

- Turning the advisory verdict into a required check.
- Mocking the model, or otherwise testing `review()` end to end.
- Touching the prompt, the criteria file, the pinned model id, or any product code.
- Adding labels, state, or a second comment per run.

## Phase 1: Test the pure helpers

### Changes Required

#### 1. Make the helpers importable without running the CLI

**Files:** `scripts/review/agent.ts`, `scripts/review/format-comment.ts`

**Intent:** Let a test import the pure functions; keep the CLIs exactly as they behave today.

**Contract:** `truncate`, `clampScores` and `render` are exported. Each file runs its CLI only when it is the process entry point, matching the guard `scripts/evals/summarize-prefill.ts` already uses.

#### 2. Cover the helpers

**Files:** `scripts/review/agent.test.ts`, `scripts/review/format-comment.test.ts`

**Intent:** Catch a regression in truncation, clamping or comment formatting without paying for a model call.

**Contract:** Truncation is a no-op below the limit and marks the output above it; clamping rounds and holds scores inside 1-10 while leaving verdict, findings and summary untouched; the rendered comment carries the verdict badge, all five criterion rows, numbered findings with their severity badges, and the empty-findings case.

### Success Criteria

#### Automated Verification

- `npx vitest run scripts/review` passes and covers all three helpers.
- `npm run lint` passes.

#### Manual Verification

- `npm run --silent review -- --diff scripts/review/fixtures/sample.diff` still reads its argument, and `npx tsx scripts/review/format-comment.ts` still reads stdin and prints Markdown.

## Phase 2: Make the manual re-review real

### Changes Required

#### 1. Take the pull request as a dispatch input

**File:** `.github/workflows/review.yml`

**Intent:** Give the manual mode the one fact it lacks — which pull request to review.

**Contract:** `workflow_dispatch` requires `pull_request`, the number of an open pull request in this repository, and the concurrency group keys off it so a re-run supersedes its own previous re-run.

#### 2. Resolve the pull request before checking out

**File:** `.github/workflows/review.yml`

**Intent:** Point the diff and the comment at the same change, whichever event started the run.

**Contract:** One step publishes `number`, `base` and `head_sha`. On `pull_request` they come from the event payload; on a dispatch, from `gh pr view`. A cross-repository pull request fails the step with a message that says why, mirroring the fork guard on the automatic path.

#### 3. Diff and comment against the resolved pull request

**File:** `.github/workflows/review.yml`

**Intent:** Make the two paths share one body.

**Contract:** Checkout uses the resolved head SHA, the base branch is fetched explicitly, the diff is `origin/<base>...HEAD` with the same exclusions, and the comment step posts to the resolved number on both events.

### Success Criteria

#### Automated Verification

- The workflow is valid YAML and the dispatch input is declared required.
- No step still gates on `github.event_name == 'pull_request'`, and no step still assumes `main` as the base.
- `actionlint` reports nothing on the workflow, if available.

#### Manual Verification

- Dispatching the workflow against this change's own pull request produces a comment on that pull request.

## Testing Strategy

- Unit tests for the pure helpers, run by the existing `scripts/**/*.test.ts` include in `vitest.config.ts`; no new runner configuration.
- The workflow is checked statically here — YAML parse plus grep for the removed assumptions — and then exercised for real by dispatching it against this change's pull request, which is the only place the dispatch path exists.

## Migration Notes

None. The trigger keeps its name; only its inputs change, so anyone who used the old dispatch was getting an empty run anyway.

## References

- The open follow-up this closes: `context/archive/2026-09-05-ci-cd-code-review/reviews/impl-review.md`
- Requirements that named `workflow_dispatch` as the retry mechanism: `context/archive/2026-09-05-ci-cd-code-review/requirements.md`
- Entry-point guard precedent: `scripts/evals/summarize-prefill.ts`

## Progress

### Phase 1: Test the pure helpers

#### Automated

- [x] 1.1 Helpers exported and CLIs guarded by an entry-point check
- [x] 1.2 Helper tests pass
- [x] 1.3 Lint passes

#### Manual

- [x] 1.4 Both CLIs still run as before

`npx vitest run scripts/review` → 2 files, 15 tests passing; `npm run lint` clean. `npx tsx scripts/review/format-comment.ts < review.json` still renders the comment from stdin, and `npm run review -- --diff <empty file>` still exits 0 with "Empty diff — nothing to review." — the guard runs the CLI exactly when the file is the entry point.

### Phase 2: Make the manual re-review real

#### Automated

- [x] 2.1 Dispatch input declared and required
- [x] 2.2 Pull request resolved once for both events, forks refused
- [x] 2.3 Diff and comment follow the resolved pull request

The workflow parses as YAML. The resolve step's script was run locally against a stubbed `gh` in all three shapes: a `pull_request` event takes number, base and head SHA from the payload; a dispatch on a same-repository pull request resolves them from `gh pr view`, including a base branch other than `main`; a dispatch on a fork pull request exits 1 with the error and writes no outputs. No step gates on `github.event_name == 'pull_request'` any more, and no step assumes `main`.

#### Manual

- [ ] 2.4 A dispatch against this change's pull request comments on it
