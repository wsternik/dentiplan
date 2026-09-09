<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Prompt evals

- **Plan**: `context/changes/prompt-evals/plan.md`
- **Mode**: Deep (delegated pass launched; local verification completed after the
  reviewer exhausted its usage allowance)
- **Date**: 2026-09-08
- **Verdict**: REVISE → SOUND (after fixes)
- **Findings**: 1 critical, 3 warnings, 0 observations

## Verdicts

| Dimension             | Verdict | After fixes |
| --------------------- | ------- | ----------- |
| End-State Alignment   | WARNING | PASS        |
| Lean Execution        | PASS    | PASS        |
| Architectural Fitness | PASS    | PASS        |
| Blind Spots           | WARNING | PASS        |
| Plan Completeness     | FAIL    | PASS        |

## Grounding

10/10 existing paths ✓ (`package.json`, `package-lock.json`, `.gitignore`,
`src/lib/llm/{prompt.ts,prompt.test.ts,client.ts}`, `README.md`, and the three
foundation documents), 3/3 intended new roots correctly absent ✓, 6/6 symbols ✓
(`buildInstructions`, `ParsedDiagnosisSchema`, `mapParsedDiagnosis`,
`DEFAULT_MODEL`, `EFFORT`, `LLM_MODEL`), brief↔plan ✓ after fixes.

The standalone Node 22/`tsx` import of the real prompt and schema was reproduced.
`docs/reference/contract-surfaces.md` was checked: the change neither renames nor
widens a registered database/content surface, and the raw-output scorer explicitly
stays before the patient-content mapper. Promptfoo and Anthropic feasibility was
grounded in the primary documentation cited by `research.md`.

## Findings

### F1 — Progress omits two automated success criteria

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: `plan.md` — Phase 1/2 Success Criteria and `## Progress`
- **Detail**: Phase 1 and Phase 2 each define four automated verification bullets,
  but their Progress blocks originally contained only three. In both phases the
  repository gates and the no-`src/` diff check were collapsed into one row. The
  Progress contract requires every criterion to have its own immutable step; an
  implementation agent could otherwise mark a phase complete without recording
  one of its gates.
- **Fix**: Add separate Progress rows for the repository gates and diff boundary
  in both phases, then renumber only the still-pending rows.
- **Decision**: FIXED — Phase 1 now has 4 automated + 2 manual rows; Phase 2 has
  4 automated + 2 manual rows; Phase 3 remains 4 + 2.

### F2 — The result report path misses the session definition of done

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Desired End State, Phase 1/2/3 report changes, research file shape
- **Detail**: The session contract requires the comparison table at
  `evals/README.md`, while the plan and research placed it at
  `evals/prefill/README.md`. Every technical criterion could pass while the named
  deliverable was absent.
- **Fix**: Keep configuration/cases below `evals/prefill/`, but move the aggregate
  report contract to `evals/README.md` everywhere.
- **Decision**: FIXED — research, full plan and brief consistently use the
  required top-level report path.

### F3 — Macro/micro/cost aggregation has no implementation owner

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Baseline evidence; Phase 2 — Decision report
- **Detail**: Promptfoo can export machine-readable results, but the plan originally
  jumped directly from that export to hand-recorded macro/micro pass rates, case
  failures and cost/latency statistics. Promptfoo's cell verdict alone does not
  define the plan's micro-atom metric. Manual arithmetic could drift between the
  baseline and full matrix or select a winner from a malformed result shape.
- **Fix ⭐**: Add a tested deterministic summarizer that consumes the Promptfoo JSON
  export, validates expected matrix dimensions and emits aggregate/per-case data
  into the ignored generated directory; transcribe/reconcile the checked-in report
  from that output.
  - Strength: One scoring definition serves both phases and makes the verdict
    reproducible without committing volatile model responses.
  - Tradeoff: Adds a small parser coupled to Promptfoo's exported result shape.
  - Confidence: HIGH — the suite already needs deterministic atom results and a
    JSON export; aggregation is a pure extension of that boundary.
  - Blind spot: Promptfoo may change its export schema on a future dependency
    upgrade; pinning the lockfile and failing on an unknown shape contains that.
- **Decision**: FIXED (Fix ⭐) — `summarize-prefill.ts` and its test are now an
  explicit phase-1 contract and source of both reports.

### F4 — The empty/noisy oracle overconstrains warnings

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: `research.md` §5; Phase 1 — Eight-case corpus
- **Detail**: The original oracle required “empty structured arrays” for a note
  containing punctuation/noise. The production prompt also instructs the model to
  preserve unplaceable phrases in `warnings`, so both an empty warning list and a
  warning echoing the noise can be correct. Requiring one would grade harmless
  warning behaviour as a reading failure.
- **Fix**: Assert only that no tooth, item, urgency or visit is invented; permit an
  empty warning list or a warning preserving the synthetic noise.
- **Decision**: FIXED — the research oracle and phase-1 contract now state that
  tolerance explicitly.

## Triage Summary

All findings were plan-text corrections within the session's fixed decisions.
No scope, provider, corpus provenance, patient-data boundary or phase order was
changed. The corrected plan is safe to implement.
