# Implementation review: review-pipeline-retry

## Verdict

APPROVED

## Scope reviewed

- `.github/workflows/review.yml`
- `scripts/review/agent.ts`, `scripts/review/format-comment.ts`
- `scripts/review/agent.test.ts`, `scripts/review/format-comment.test.ts`

## Findings

No critical or high findings.

- The two paths through the workflow now share one body. The only branch left is the resolve step, and it produces the same three outputs either way, so the diff and the comment cannot drift apart.
- Checking out a head SHA leaves no local branch, so the base is fetched by name before the diff. Without that step the diff would fail on a dispatch rather than come back empty — worth keeping in mind if the exclusions are ever edited.
- The entry-point guard is the pattern already used by `scripts/evals/summarize-prefill.ts`, so importing either CLI is now inert; both were run directly afterwards to confirm they still are CLIs.
- Warning, not blocking: the tests cover the pure helpers only. `review()` still has no test, deliberately — a mocked model would assert the mock. That remains recorded, not forgotten.

## Verification

- `npx vitest run scripts/review` → 2 files, 15 tests passing.
- `npm test` → 21 files, 163 tests passing (148 before this change).
- `npm run lint` passed.
- The workflow parses as YAML; the resolve step's script was executed locally against a stubbed `gh` for a `pull_request` event, a same-repository dispatch with a non-`main` base, and a fork dispatch (exit 1, no outputs written).
- `npx tsx scripts/review/format-comment.ts < review.json` renders the comment; `npm run review -- --diff <empty>` exits 0 with "Empty diff — nothing to review."
- The dispatch path itself only exists on GitHub; it is exercised by dispatching this workflow against this change's own pull request.

## Second pass — the pipeline's own review of this pull request

The workflow reviewed this change on pull request #18: APPROVED, two minor findings.

1. **The fork guard ships without a test** (tests proportional to risk). Accepted and fixed. `scripts/review/resolve-pr.test.ts` extracts the resolve step's script out of `.github/workflows/review.yml` and runs it against a stubbed `gh` in three shapes: event payload, dispatch on a same-repository pull request with a non-`main` base, and dispatch on a fork. Extracting rather than copying is what makes the test bind: replacing the `isCrossRepository` comparison with `if false` in the workflow turns the third case red, which was verified before the fix was committed.
2. **The entry-point guard is duplicated in two files** (fit with this codebase). Declined, as the finding itself suggests. One line in two CLIs is cheaper to read than a module whose only job is to hide it; the finding is worth revisiting when a third script needs the pattern.

Re-verified after the fix: `npm test` → 22 files, 166 tests passing; `npm run lint` clean.

## Third pass — and the last one this change pays for

APPROVED again, three minor findings, "mergeable as-is". Two were taken:

1. **`gh pr view` relied on `GH_REPO` implicitly.** Now `--repo "$GH_REPO"` at the call site, so the property that matters — the number is resolved in this repository — is readable where it is used. The test asserts the flag is there, and `set -u` made the point immediately: the first run without `GH_REPO` in the test environment failed loudly.
2. **The suite skipped itself when `jq` was missing, silently.** It now skips only outside CI. `jq` is preinstalled on GitHub's runners, so its absence there means the runner changed, which is a failure worth seeing; a developer machine without it still skips a suite about a shell script it cannot run.

The third — extraction anchored on string markers in the workflow is fragile — is answered rather than declined outright. Moving the script into its own file, as the finding suggests, is not available: the resolve step runs _before_ `actions/checkout`, so there is no working tree to hold it, and checking out twice to make room for one file costs more than it buys. Instead the extraction now has its own assertion: if the anchors ever drift, the first failure says the script could not be extracted, rather than the fork check failing for no visible reason.

Re-verified: `npm test` → 22 files, 167 tests passing; `npm run lint` clean.

No fourth pass. The change has had one local review round and the pipeline's own comment read twice over; another round would be paid for out of the same budget that funds the work.
