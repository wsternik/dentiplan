<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Quotes Data Foundation (F-01)

- **Plan**: context/changes/quotes-data-foundation/plan.md
- **Scope**: All 4 phases (full plan)
- **Date**: 2026-06-03
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

## Evidence re-run this review

- `npx astro check` — 0 errors, 0 warnings
- `npm run lint` — clean
- `supabase db reset` — migration applies cleanly
- SQL probe (`psql ... quotes_foundation_probe.sql`) — ALL PASSED (a, b, b4, c, d)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Plan fidelity: every "Changes Required" item across all 4 phases verified MATCH.
No DRIFT, no MISSING. EXTRAs (PriceValue, CostRange, QuoteTotals, dentitionForTooth,
probe assertion b4) are direct realizations of plan requirements, not scope creep.

## Findings

### F1 — Approved-row invariants not pinned in schema

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260603194110_quotes_foundation.sql:26-31
- **Detail**: A row could be status='approved' while token IS NULL or approved_at IS NULL, and the immutability trigger makes that state permanent. A NULL-token approved quote is unreachable via get_quote_by_token; a NULL approved_at is a forensic snapshot (FR-053) missing its own timestamp. F-01 ships no approval code, so the risk is future S-01 discipline — exactly what a schema foundation should pin.
- **Fix A ⭐ Recommended**: Add two CHECK constraints (`status <> 'approved' or token is not null`; `status <> 'approved' or approved_at is not null`).
  - Strength: Defense-in-depth at the layer that owns the invariant; in-scope; can't be bypassed by an S-01 bug; doesn't block the draft→approved path.
  - Tradeoff: Touches the load-bearing migration post-ship; needs db reset locally.
  - Confidence: HIGH — standard Postgres conditional CHECK.
  - Blind spot: None significant — probe's approving UPDATE sets both fields.
- **Fix B**: Leave as-is; rely on S-01 to set both fields; accept as risk.
- **Decision**: FIXED via Fix A — added `quotes_approved_has_token` and `quotes_approved_has_timestamp` CHECK constraints. Re-ran db reset + probe: all assertions pass.

### F2 — Trigger function omits `set search_path = ''`

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260603194110_quotes_foundation.sql:82-89
- **Detail**: The RPC pins search_path; prevent_approved_update() did not. Not exploitable today (body references only OLD/NEW/raise), but a future edit adding a table reference would inherit an unpinned path.
- **Fix**: Add `set search_path = ''` to the trigger function for consistency with the hardened RPC.
- **Decision**: FIXED — added `set search_path = ''` to `prevent_approved_update()`. Probe (c) and (d) still pass.

### F3 — PatientView is hand-written, not derived from the RPC type

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/types.ts:191-196
- **Detail**: PatientView mirrored get_quote_by_token's return shape by hand rather than aliasing the generated Returns type, so it could drift if the RPC columns change.
- **Fix**: Alias PatientView from the generated function Returns type (override content → QuoteContent, patient_type → PatientType).
- **Decision**: FIXED — `PatientView` now derives from `Database["public"]["Functions"]["get_quote_by_token"]["Returns"][number]`. astro check 0 errors, lint clean.
