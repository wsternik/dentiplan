<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Home and visual system

- **Plan**: `context/changes/home-visual-system/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-09
- **Verdict**: SOUND
- **Original verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 1 observation — all fixed

## Verdicts

| Dimension             | Verdict          |
| --------------------- | ---------------- |
| End-State Alignment   | PASS             |
| Lean Execution        | PASS             |
| Architectural Fitness | PASS after F1    |
| Blind Spots           | PASS after F2    |
| Plan Completeness     | PASS after F2/F3 |

## Grounding

18/18 existing plan paths found; 3/3 planned-new paths accounted for; 7/7
targeted symbols and contracts found; brief ↔ design brief ↔ research consistent.
Progress has one bottom section, 6/6 matching phase names, 32/32 matching success
criteria, and no misplaced checkboxes.

## Findings

### F1 — Unsafe interim meaning for the font migration

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Critical Implementation Details; Phase 1
- **Detail**: `font-serif` currently reaches eight files, including the complete patient document. Mapping it directly to Fraunces in Phase 1 would turn long prose into display type before the surface phases migrate consumers.
- **Fix**: Keep a temporary `font-serif` compatibility role mapped to Manrope, expose Fraunces through an explicit editorial utility, migrate consumers by intent in Phases 2–5, then remove the alias in Phase 6.
- **Decision**: FIXED

### F2 — A4 PDF criterion had no reproducible verifier

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots / Plan Completeness
- **Location**: Phase 5; Testing Strategy
- **Detail**: The existing print E2E verifies only two-column geometry. The plan required A4 dimensions, text, QR, and footer bounds while naming no script or command and forbidding edits to existing specs.
- **Fix**: Add `scripts/verify-patient-print.ts` with a fixed command. It measures the print DOM at 717 px, checks content/QR/footer bounds, and emits an A4 PDF with backgrounds disabled; visual readability remains the non-blocking manual check.
- **Decision**: FIXED

### F3 — Password toggle missing from sign-in scope

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Sign-in states
- **Detail**: `PasswordToggle.tsx` owns a directly styled focusable control and the accessible names `Show password` / `Hide password`, but was not listed.
- **Fix**: Add `SignInForm.tsx` and `PasswordToggle.tsx` to Phase 3 and freeze both names and behaviour.
- **Decision**: FIXED
