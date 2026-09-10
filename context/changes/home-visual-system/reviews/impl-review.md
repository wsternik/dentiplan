<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Home and visual system implementation plan

- **Plan**: `context/changes/home-visual-system/plan.md`
- **Scope**: Phases 1–6 of 6
- **Date**: 2026-09-10
- **Verdict before triage**: NEEDS ATTENTION
- **Verdict after triage**: APPROVED
- **Findings**: 0 critical, 5 warnings, 2 observations

## Verdicts

| Dimension           | Before triage | After triage |
| ------------------- | ------------- | ------------ |
| Plan Adherence      | WARNING       | PASS         |
| Scope Discipline    | PASS          | PASS         |
| Safety & Quality    | WARNING       | PASS         |
| Architecture        | PASS          | PASS         |
| Pattern Consistency | PASS          | PASS         |
| Success Criteria    | WARNING       | PASS         |

## Findings

### F1 — Brand accent ink misses normal-text contrast

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/styles/global.css:33`
- **Detail**: `--brand-ink` measured 3.66:1 on the page background and 3.49:1 on the composed soft surface while several consumers render it at 11–12 px.
- **Fix**: Darken the semantic token rather than patch individual consumers.
- **Decision**: FIXED — changed the light token to `oklch(0.56 0.1662 32.9)`; measured 4.80:1 on the page background and 4.58:1 on the soft surface. Updated the design brief target.

### F2 — The verifier measures a wider page than the PDF it emits

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: `scripts/verify-patient-print.ts:6`
- **Detail**: Layout assertions ran at 717 px, but A4 with the shipped 15 mm margins leaves about 680 px. The script could therefore pass before emitting a narrower PDF.
- **Fix**: Derive the viewport from A4 width and the shipped margins.
- **Decision**: FIXED — the verifier now computes 680 px from 210 mm minus two 15 mm margins; the plan records the stricter geometry.

### F3 — Brand colour survives in the black-on-white print contract

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/styles/global.css:245`
- **Detail**: The recommended variant uses `border-l-brand`, but print tokens did not replace brand colours with black.
- **Fix**: Override both brand tokens in the print `:root`.
- **Decision**: FIXED — `--brand` and `--brand-ink` are black under `@media print`.

### F4 — S-11 is missing from the roadmap index and named history

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `context/foundation/roadmap.md:28`
- **Detail**: The plan requires S-11 in At a glance and the detailed/done history, including the source brief, dependencies, and done status. Only an anonymous Done entry existed.
- **Fix**: Add the indexed slice and complete its named Done entry.
- **Decision**: FIXED — added `S-11 / home-visual-system`, dependencies S-01/S-06/S-07/S-10, source brief, and `done` status.

### F5 — Risk #14 lacks its contract and rollout IDs collide

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `context/foundation/test-plan.md:76`
- **Detail**: Risk #14 was present only in the map, and both the provider and public-entry rollout rows used phase ID 9.
- **Fix**: Add the detailed risk contract and assign the new public-entry phase the next ID.
- **Decision**: FIXED — added the home/surface contract row and changed Public entry contract to phase 10.

### F6 — Product documentation contradicts the new palette

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `README.md:187`, `context/foundation/roadmap.md:59`
- **Detail**: Both documents still claimed saturated colour was reserved for clinical meaning even though coral is a deliberate decorative brand accent.
- **Fix**: Describe brand and clinical colour as separate semantic families.
- **Decision**: FIXED — updated both descriptions without broadening product claims.

### F7 — A prototype base anchor remains raw in a component

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/components/home/TreatmentPlanIllustration.astro:22`
- **Detail**: The illustration repeated the soft-surface anchor `#eee8f0` instead of consuming its semantic token.
- **Fix**: Replace the raw value with `bg-secondary`.
- **Decision**: FIXED.

## Verification after fixes

- `npm run lint` — exit 0.
- `npx astro check` — exit 0; 139 files, 0 errors, 0 warnings, 4 hints.
- `npm test` — exit 0; 22 files and 167 tests passed.
- `npm run build` — exit 0.
- `npm run test:e2e` — exit 0; 14 tests passed without edits to existing specs.
- `node --import tsx scripts/verify-patient-print.ts http://localhost:4321/p/mw0sKeNdQrvma7UVaLGskg /tmp/dentiplan-patient-a4-review.pdf` — exit 0 at the derived 680 px width.
- Prototype ignore, zero tracked prototype files, sole E2E addition, retired font/anchor scan, and `git diff --check` — pass.

## Triage summary

- **Fixed**: F1–F7.
- **Skipped**: none.
- **Accepted without fix**: none.
