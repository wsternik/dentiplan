<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: First Thin Quote & Patient Link (S-01)

- **Plan**: context/changes/first-thin-quote-and-patient-link/plan.md
- **Scope**: All 4 phases (full plan)
- **Date**: 2026-06-04
- **Verdict**: NEEDS ATTENTION (all findings resolved in commit be878f5)
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated criteria all green at review time: `npm run test` (23/23), `npm run lint` (exit 0), `npm run build` (complete). All four phases' planned files were implemented and matched intent. The shadcn `select` → custom `NativeSelect` (controls.tsx) swap and the extra `labels.ts`/`types.ts`/`format.ts` files are sensible decomposition, not scope creep. All "What We're NOT Doing" guardrails upheld. Token entropy, server-side price re-resolution, single INSERT-as-approved, and the anonymous no-disclosure invariant all verified correct.

## Findings

### F1 — Server doesn't re-validate tooth FDI numbers before freezing

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/admin/quotes/approve.ts:43
- **Detail**: `ApproveToothSchema.number` was `z.number().int()` — any integer passed. The editor blocks invalid FDI numbers client-side, but the approval handler did not re-validate them, despite the plan stressing server-authoritative freezing ("don't rely on the client guard"). A buggy/tampered client could freeze a tooth like `99` into an immutable quote, rendered to the patient via the toothName sentinel. Empty/unpriced were already re-checked server-side; FDI validity was the one client guard not mirrored.
- **Fix**: Refined the schema's `number` field with the existing `isValidToothNumber` predicate (from tooth-name.ts) so unknown numbers 400 like unknown pricelist ids already do.
- **Decision**: FIXED (commit be878f5)

### F2 — Patient-visible `note` is unbounded free text

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/admin/quotes/approve.ts:47
- **Detail**: The per-tooth `note` (`z.string().default("")`, no `.max`) is written into `content` and rendered verbatim to anonymous patients (ScenariosSection.astro:36, DeferredSection.astro:24). This is by-design (note is in the patient-safe schema, not the rawText/diagnosis leak, which is correctly dropped), but it was unbounded free text the dentist could paste PII into, frozen immutably — and an authenticated session could write large JSONB via note/id strings.
- **Fix**: Bounded `note` to `.max(500)` and pricelist/general id strings to `.max(64)` in the request schema.
- **Decision**: FIXED (commit be878f5)

### F3 — admin/index.astro doesn't read Astro.locals.user

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/admin/index.astro
- **Detail**: Plan Phase 2 says the shell "reads Astro.locals.user". The page didn't — it relied entirely on middleware's PROTECTED_ROUTES gate. No security gap (the route IS protected), purely a deviation from the plan text.
- **Fix**: Read `const { user } = Astro.locals` and attribute the session in the shell, matching the dashboard.astro pattern. (An initial early-return redirect was reverted because a top-level `return` in Astro frontmatter crashes the `@typescript-eslint/no-misused-promises` rule; the read-and-render pattern matches the existing convention and middleware already handles redirects.)
- **Decision**: FIXED (commit be878f5)
