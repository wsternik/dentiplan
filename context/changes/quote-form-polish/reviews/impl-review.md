<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Save diagnosis notes and simplify the quote form

- **Plan**: `context/changes/quote-form-polish/plan.md`
- **Scope**: Phases 1–5 of 5
- **Date**: 2026-09-07
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | FAIL    |

## Findings

### F1 — FDI labels have insufficient contrast on clinical fills

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/components/tooth-chart/ToothChart.tsx:205`
- **Detail**: The new 12px `fill-muted-foreground` labels sit directly on four urgency fills at roughly 1.08:1–3.11:1, below the contrast floor for patient-facing clinical text and contrary to `lessons.md`.
- **Fix**: Put each number on an opaque background/foreground token plate and keep the plate centred inside the tooth; pin the contrast-bearing token pair in the focused label test.
- **Decision**: FIXED — every label now has an enamel backing plate and foreground ink, independent of urgency fill.

### F2 — Full-branch E2E diff exceeds the plan's recorded exception

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Success Criteria
- **Location**: `context/changes/quote-form-polish/plan.md:35`
- **Detail**: Four existing quote-creation scenarios gained a disclosure setup click and the risk-#3 comment changed, while the plan said the complete E2E diff would contain only two heading substitutions. The clicks are required by the approved note-first journey and preserve every existing role, label, and assertion, but the source of truth did not record that exception.
- **Fix A ⭐ Recommended**: Add a narrow plan addendum for the four setup clicks and truthful comment while keeping all existing semantic locators and assertions frozen.
  - Strength: Preserves the approved progressive-disclosure flow and makes the review contract match the intentional journey change.
  - Tradeoff: Records a deliberate exception to the repository's strict existing-spec rule.
  - Confidence: HIGH — the diff contains only the named clicks/comment beyond the already approved literals.
  - Blind spot: Future reviewers must continue treating this as a one-change exception, not a general relaxation.
- **Fix B**: Remove progressive disclosure so all previous setup steps stay directly reachable.
  - Strength: Satisfies the original E2E-diff sentence literally.
  - Tradeoff: Removes the central product outcome of phase 3.
  - Confidence: HIGH — visible manual fields would restore the old journey.
  - Blind spot: It would directly contradict the accepted session scope.
- **Decision**: FIXED via Fix A — the exact exception and rationale are now recorded in the plan.

### F3 — Specified Polish copy is incomplete

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/pages/index.astro:36`
- **Detail**: The landing example still used general-anaesthesia copy based on “znieczulenie”; the diagnosis section still displayed “(roboczo)” and wording different from the agreed private-note sentence.
- **Fix**: Apply “narkoza” to the three landing strings, remove “(roboczo)”, and use the agreed truthful note wording while preserving the existing accessible locator.
- **Decision**: FIXED.

### F4 — Write snapshots can diverge from the still-editable form

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/components/admin/QuoteEditor.tsx:318`
- **Detail**: Save and approval capture state before awaiting the request, but other controls remained editable. A later edit could be omitted while “Zapisano” was shown, or permanently lost when approval replaced the editor with a confirmation.
- **Fix**: Make the complete editor inert for every server write, drive both terminal buttons from the shared busy state, and keep the parsing overlay limited to parsing.
- **Decision**: FIXED.

### F5 — Migration and contract records are incomplete

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `docs/reference/contract-surfaces.md:24`
- **Detail**: The load-bearing registry omitted `quotes.diagnosis_note` and retained the old local type-generation command. The change plan marked migration application complete without recording the local/remote versions, and used “autosave” for an explicitly manual draft-save path.
- **Fix**: Register the private column, update the type-generation command, record the verified migration histories, and correct the draft-save terminology.
- **Decision**: FIXED.

## Verification

- `npm test`: 127/127 passed before triage.
- `npm run lint`: passed before triage.
- `npm run build`: passed before triage.
- `npm run test:e2e`: 9/9 passed before triage.
- `npx supabase migration list`: local and remote both contain `20260603194110` and `20260907085625`.

## Triage Summary

- Fixed: F1, F2 (Fix A), F3, F4, F5.
- Post-fix verification: `npm test` 128/128, `npm run lint`, `npm run build`, and `npm run test:e2e` 9/9 all pass.
- The phase-1 commit diff contains only the two approved E2E heading substitutions; the full-branch additions are exactly the documented disclosure/comment exceptions plus new specs.
