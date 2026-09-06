<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: a first-pass review agent on every pull request

- **Plan**: none — this change was framed from `requirements.md`, not from research and a plan (`change.md` says why)
- **Scope**: the eight commits behind PR #4, `533e871..fdfca3e`, merged as `c73cffd`
- **Reviewed**: 2026-09-05, on the pull request itself · **Recorded here**: 2026-09-06, at archive time
- **Reviewer**: the agent this change adds, running on the pull request that adds it
- **Verdict**: APPROVED on all three runs — 2 findings fixed, 1 documented, 1 rejected with reason, 3 knowingly left open

## Why this is not a `/10x-impl-review` report

`/10x-impl-review` compares an implementation against its plan; this change has no
plan to compare against, so the skill has nothing to resolve. The review that
mattered here happened anyway, in the place this change exists to create: the
pull request. This file records it from the PR's own comments so the trail is in
the repository and not only in GitHub's UI.

## The three runs

| #   | Run (UTC) | Head under review                                             | Verdict              | Outcome                              |
| --- | --------- | ------------------------------------------------------------- | -------------------- | ------------------------------------ |
| 1   | 07:37:35  | `49c9f39` — the pipeline as first written                     | APPROVED, 3 findings | two fixed in `b05547a`, one rejected |
| 2   | 07:40:44  | `b05547a` — after the first two fixes                         | APPROVED, 3 findings | one new one fixed in `fdfca3e`       |
| 3   | 07:44:19  | `fdfca3e` — landed just after the merge (`c73cffd`, 07:42:25) | APPROVED, 3 findings | all three left open, see below       |

Every re-run is the consequence of a real fix, not a repeat for a nicer verdict.

## Findings and what happened to each

**Fixed — `b05547a`**

1. **Scores were bounded only by the prompt.** `REVIEW_SCHEMA` declares `z.number()`
   with no `min`/`max`, because Anthropic's structured output rejects
   `minimum`/`maximum` on a number. An out-of-range or fractional score would have
   passed validation and gone straight into the comment on someone's PR.
   `clampScores()` now rounds and bounds on the way out.
2. **The model id was hardcoded**, against the advice of the `ai-sdk` skill that the
   same PR was adding. Now `process.env.REVIEW_MODEL ?? "claude-sonnet-5"`, with a
   comment stating why pinning is deliberate here: a swap changes every verdict
   downstream, so it should take a commit.

**Fixed — `fdfca3e`**

3. **The fixture read like a reference implementation.** `fixtures/sample.diff` is a
   plausible-looking admin endpoint with an interpolated PostgREST filter and patient
   e-mails in the log, and nothing in the repo said "do not copy this". It now carries
   a header that doubles as the expected result: a run that fails to find the filter
   injection, the missing authorization check, the unbounded `limit` and the absent
   tests is a run to go and fix the prompt over. Still `REJECTED` with both blockers
   after the change.

**Rejected, with the reason in the commit body**

4. **A test that runs the agent against the fixture.** It would have to either call the
   API from the suite or mock the model — and a mocked model asserts only that our own
   formatter works. Declined in `b05547a`, not forgotten.

## Still open, deliberately — verified at `d88c5e9` on 2026-09-06

The third run's three findings all still hold. None of them is a defect in the
application; all three are about the tooling's own safety net.

| Finding                                                                                                       | Verification                                                                                      |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `clampScores()`, `truncate()` and `render()` have no unit test, so a regression in them is caught by nobody   | `ls scripts/review/` → `agent.ts criteria.md fixtures format-comment.ts schema.ts` — no test file |
| the pinned model id has no recorded provenance and would fail silently if it went stale                       | `agent.ts:20-25` — the comment explains the pinning, not where the id was verified                |
| `clampScores()` runs inside `agent.ts` only, so any other consumer of the agent's JSON gets unclamped numbers | `schema.ts:29` — `score()` is still a bare `z.number()`                                           |

The first of these is the same finding as #4 above, restated at the layer where it is
cheap: the pure helpers, not the model call. That version of it has no answer yet.

## What the review got right that a checklist would not have

- **It read the planted fixture as test data, not as a defect to report.** Both runs
  said so explicitly. A naive reviewer files two blockers against its own PR here.
- **It scored the criteria this diff does not touch neutrally rather than punishing
  them** — 5/10 on validation, RLS and the patient page with "not applicable here",
  and zero findings against them, instead of padding the list to three. That
  instruction is in the prompt and it held.

## Follow-up carried out of this review

- **Unit-test the pure helpers** (`clampScores`, `truncate`, `render`) — the one open
  finding with no counter-argument. Cheap, deterministic, no API call, no mock of the
  model. Nothing else in `scripts/review/` needs a test before it.
