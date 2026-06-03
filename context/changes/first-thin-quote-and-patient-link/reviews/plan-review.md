<!-- PLAN-REVIEW-REPORT -->
# Plan Review: First Thin Quote & Patient Link (S-01)

- **Plan**: context/changes/first-thin-quote-and-patient-link/plan.md
- **Mode**: Deep
- **Date**: 2026-06-04
- **Verdict**: REVISE (all findings fixed → SOUND)
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

11/11 paths ✓, symbols (middleware PROTECTED_ROUTES / sitemap integration / pricing barrel) ✓, brief↔plan ✓, contract-surfaces F-01/F-02/content-invariant ✓. Deep verification confirmed: RLS INSERT policy `quotes_authenticated_insert` exists with `with check (true)` (migration:65–67); immutability trigger is BEFORE UPDATE only (migration:99); approval check constraints `quotes_approved_has_token` / `quotes_approved_has_timestamp` (migration:37–38); full content type tree matches plan (types.ts:74–173); resolver throws on unknown id (resolver.ts:53–64).

## Findings

### F1 — Live-preview totals need resolved prices the picker data doesn't carry

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 §2 (picker serialization) + §3 (Live totals)
- **Detail**: Phase 2 serialized `listByCategory()` / `listToothItems()` / `listGeneralItems()`, which return `SourcePricelistItem[]` (`price_type` / `price_min` / `price_max`, no resolved `price`, no category field) — resolver.ts:67–79. But the cost engine input `ToothEntry.pricelistItems` is `PricelistItemRef[]` with `price: PriceValue` (types.ts:106–115, 87–93), so the island cannot compute live totals from the serialized picker data as written. An unspecified `SourcePricelistItem → PriceValue` step sat between picking an item and feeding `computeQuoteTotals`.
- **Fix**: Serialize resolved `PricelistItemRef`-shaped picker options (map each source item through `resolvePricelistItem(item.id)` server-side, attach category label). Island uses them for both picker and live totals; approval still POSTs by `id` for an independent server-side freeze.
- **Decision**: FIXED — Fix in plan (Phase 2 §2 contract rewritten).

### F2 — Phase 2 Progress merges two success criteria into one tracking line

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 Manual Verification ↔ Progress 2.5
- **Detail**: Phase 2 lists 5 manual success criteria but Progress had 4 (2.4–2.7); 2.5 collapsed the `17,16,34` happy path and the `99` out-of-range warning into one line. Phases 1/3/4 mapped 1:1.
- **Fix**: Split into 2.5 (`17,16,34` rows) and 2.6 (`99` warning); renumber 2.6→2.7, 2.7→2.8.
- **Decision**: FIXED — Fix in plan.

### F3 — Sitemap exclusion is a non-issue; the real lever is noindex (+ Referer)

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Critical Detail "Patient page must not be indexable" + criterion 4.4
- **Detail**: `@astrojs/sitemap` only enumerates build-time-known routes; `/p/[token]` is an SSR dynamic route with no `getStaticPaths`, so its URL can never appear in the sitemap. Criterion 4.4 passes trivially and the "exclude from sitemap" work is a no-op. The real protection is `noindex` (already present). One genuine gap: the token is a capability secret and leaks via `Referer`.
- **Fix**: Reword the Critical Detail + 4.4 to reflect the SSR-sitemap reality; add `Referrer-Policy: no-referrer` to `/p/[token]`.
- **Decision**: FIXED — Fix in plan (Critical Detail, Phase 4 §1, criterion 4.4, Progress 4.4/4.8).

### F4 — Phase 3/4 must handle createClient() returning null

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 §1 (approve route), Phase 4 §1 (patient route)
- **Detail**: `createClient(headers, cookies)` returns `null` when env is unset (supabase.ts:6–8). The approve handler and patient page used the result without guarding the null branch. Existing auth routes already guard this.
- **Fix**: Note the null → 500 (approve) / generic-error (patient) guard in both phase contracts.
- **Decision**: FIXED — Fix in plan.
