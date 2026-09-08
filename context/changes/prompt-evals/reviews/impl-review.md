<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Prompt evals implementation plan

- **Plan**: `context/changes/prompt-evals/plan.md`
- **Scope**: Phases 1–3 of 3
- **Date**: 2026-09-08
- **Verdict**: REJECTED
- **Findings**: 1 critical, 5 warnings, 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | FAIL    |
| Scope Discipline    | PASS    |
| Safety & Quality    | FAIL    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | FAIL    |

## Findings

### F1 — Invented billable items do not fail safety eligibility

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `scripts/evals/assertions.ts:131-175`
- **Detail**: The scorer marks the combined per-tooth comparison as quality-only. In the retained Polish/Sonnet run, tooth 24 received the billable `leczenie-zachowawcze:wypelnienie-male-duze` item although the fixed oracle expects no item, yet the cell remained safety-eligible and became the recorded winner. Conversely, symmetric exact-set checks mark omissions as safety failures even though the fixed rule reserves safety eligibility for invented content, missing required warnings, and invalid wire shape.
- **Fix**: Split or dynamically classify tooth/general-item checks so unexpected teeth, treatments, or catalog ids are safety failures while omissions and other mismatches remain quality failures; add regression tests, rerun the full uncached matrix, and revisit the winner.
  - Strength: Makes the scorer implement the predeclared rule and directly covers risk #7.
  - Tradeoff: Requires another paid 32-call run and may change the production decision.
  - Confidence: HIGH — the retained raw output demonstrates the misclassification.
  - Blind spot: Provider nondeterminism means the rerun may expose different failures as well.
- **Decision**: PENDING

### F2 — Matrix shape accepts duplicate and missing cases

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `scripts/evals/summarize-prefill.ts:99-126`
- **Detail**: Validation checks only aggregate row and cell counts. A cell containing two copies of case `one` and no case `two` is accepted, so an incomplete matrix can be summarized as complete.
- **Fix**: Validate the exact prompt × provider × case Cartesian product and reject missing, duplicate, or unknown tuples.
- **Decision**: PENDING

### F3 — Missing telemetry is silently reported as zero

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `scripts/evals/summarize-prefill.ts:142-150`
- **Detail**: Missing token, cost, and latency fields default to zero even though they are ranking tie-breakers. Incomplete provider telemetry can therefore appear free and instantaneous.
- **Fix**: Require finite nonnegative telemetry on every row, with a separate explicit path only if cost must be derived from token usage.
- **Decision**: PENDING

### F4 — Recorded source SHA cannot reproduce the measured matrix

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: `scripts/evals/prepare-prefill.ts:75`, `evals/README.md:93-102`
- **Detail**: The full run records `531fd3b` as its source revision, but that commit predates the English prompt and two-prompt configuration; those first appear in `b205288`. Metadata records neither dirty state nor hashes for the evaluator/configuration, so the stated SHA is not a checkoutable representation of the run.
- **Fix**: Require future measured runs to start from a clean committed tree and hash the configuration, scorer, schema adapter, provider schema, and prompt modules. Document the retained run's base-HEAD limitation and the first commit containing its exact hashed prompt/corpus inputs.
  - Strength: Restores an auditable checkout for the rerun and makes future provenance self-validating.
  - Tradeoff: Adds preparation metadata and requires committing scorer fixes before the paid run.
  - Confidence: HIGH — Git history proves the recorded SHA lacks the candidate.
  - Blind spot: The old run's uncommitted diff cannot be reconstructed byte-for-byte beyond retained hashes.
- **Decision**: PENDING

### F5 — Promptfoo does not support the repository's pinned Node version

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: `.nvmrc:1`, `package-lock.json:21155`, `evals/README.md:11`
- **Detail**: Promptfoo 0.122.2 declares Node `>=22.22.0`, while the repository and eval instructions pin Node 22.14.0. The documented clean-checkout runtime is outside the dependency's supported range.
- **Fix A ⭐ Recommended**: Pin the newest Promptfoo release whose engine supports Node 22.14.0 and regenerate the lockfile.
  - Strength: Keeps the repository's established runtime unchanged and limits the change to eval tooling.
  - Tradeoff: May give up fixes present only in 0.122.2.
  - Confidence: MEDIUM — exact compatible release still needs registry verification.
  - Blind spot: A compatible release may differ in export shape and require a small adapter update.
- **Fix B**: Upgrade `.nvmrc` and all runtime documentation to a Promptfoo-supported Node 22 release.
  - Strength: Retains the current Promptfoo implementation unchanged.
  - Tradeoff: Broadens a dev-tool change into a repository-wide runtime migration.
  - Confidence: MEDIUM — the application gates must be rerun under the new pin.
  - Blind spot: Deployment/runtime parity has not been assessed for a Node-pin change.
- **Decision**: PENDING

### F6 — Decision report omits planned token and failure detail

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `evals/README.md:47-52`, `evals/README.md:82-91`
- **Detail**: The plan requires total/median token use and per-case failure reasons. The table contains aggregate input/output totals but no median token statistic, while the case table says only `tooth details` rather than which status, urgency, treatment, or id differed.
- **Fix**: Add median token metrics to the summarizer/report and replace generic case labels with concise, auditable failure reasons from the rerun.
- **Decision**: PENDING

### F7 — Branch diff fails the whitespace check

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `context/changes/prompt-evals/plan-brief.md:3`, `context/changes/prompt-evals/research.md:16-19`
- **Detail**: `git diff --check origin/main...HEAD` reports trailing whitespace, so a marked-complete automated criterion is currently red.
- **Fix**: Run Prettier on the two Markdown files and repeat the branch-range whitespace check.
- **Decision**: PENDING
