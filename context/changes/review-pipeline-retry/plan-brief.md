# Manual re-review and review helper tests — Plan Brief

> Full plan: `context/changes/review-pipeline-retry/plan.md`

## What & Why

`workflow_dispatch` on the AI review workflow promises an on-demand retry it cannot deliver: it checks out a branch (`main` by default), diffs `origin/main...HEAD` to nothing, and has no pull request number to comment on. Either the promise goes or the mode works. It should work — a review is exactly the job one wants to re-run after a transient provider error. The same change closes the one follow-up the pipeline's own implementation review left open: the three pure helpers have no test.

## Starting Point

`.github/workflows/review.yml` has a bare `workflow_dispatch:` trigger and a comment step gated on `github.event_name == 'pull_request'`. `truncate` and `clampScores` in `scripts/review/agent.ts` and `render` in `scripts/review/format-comment.ts` are module-private, and both files run their CLI at import time, so nothing can import them.

## Desired End State

Dispatching the workflow with a pull request number reviews that pull request and comments on it, exactly as the automatic run does. The three helpers are exported, covered by deterministic tests that call no API, and the CLIs still behave the same when executed.

## Key Decisions Made

| Decision                           | Choice                                      | Why                                                                                                                           |
| ---------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Manual mode                        | Required pull request number input          | The alternative — deleting the trigger and telling people to use "Re-run jobs" — loses the case where the run itself is gone. |
| Fork pull requests                 | Refuse with a clear error                   | The dispatch path would otherwise hand repository secrets to a fork's code, which the `pull_request` guard exists to prevent. |
| Where the pull request is resolved | One step, before checkout, via `gh pr view` | Base branch and head SHA belong together; resolving both once keeps the diff and the comment pointed at the same change.      |
| Helper tests                       | Pure functions only, no mocked model        | A mocked model would assert our own mock. The formatter and the clamp are where a regression would actually slip through.     |

## Scope

**In scope:** `.github/workflows/review.yml`, `scripts/review/agent.ts`, `scripts/review/format-comment.ts`, new tests under `scripts/review/`.

**Out of scope:** the prompt, the criteria, the model pin, making the verdict a required check, any product code.

## Phases at a Glance

| Phase                    | What it delivers                                                | Key risk                                                                     |
| ------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1. Test the pure helpers | Exported helpers with deterministic coverage                    | Exporting must not change CLI behaviour — the entry guard has to be right.   |
| 2. Real manual re-review | Dispatch input, resolved checkout, comment on that pull request | Workflow logic is only fully exercised on GitHub; local checks are indirect. |

**Prerequisites:** clean `main`.

## Success Criteria (Summary)

- `npm test` covers `truncate`, `clampScores` and `render`, and passes.
- Both CLIs still print what they printed before when run directly.
- The dispatch path names a pull request, diffs against that pull request's base, and comments on it; forks are refused.
