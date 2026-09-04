<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Admin Quote List & Draft Lifecycle (S-03)

- **Plan**: `context/changes/admin-quote-list/plan.md`
- **Scope**: Phases 1–4 of 4 (automated criteria complete; manual criteria pending)
- **Date**: 2026-09-04
- **Verdict**: APPROVED after F1
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension           | Verdict                                    |
| ------------------- | ------------------------------------------ |
| Plan Adherence      | PASS                                       |
| Scope Discipline    | PASS                                       |
| Safety & Quality    | WARNING → PASS after F1                    |
| Architecture        | PASS                                       |
| Pattern Consistency | PASS                                       |
| Success Criteria    | PASS (automated) — 17 manual items pending |

## Method

Two independent sub-agents read the branch cold against `main`: one auditing every planned change for drift, one auditing safety, reliability and pattern compliance with the schema, `docs/reference/contract-surfaces.md` and the `test-plan.md` risk map as grounding.

All eight load-bearing claims the plan makes about the implementation were checked and hold:

1. `.select("id")` + empty-array → 409 on all three guarded statements (`[id].ts:66-81`, `:103-109`, `approve.ts:101-119`) — the plan-review's F3, correctly implemented everywhere it is needed.
2. The `draft → approved` transition is one statement setting `status`, `token`, `approved_at`, `content` and `patient_email` together (`approve.ts:101-113`), so no path leaves a row violating `quotes_approved_has_token` / `_has_timestamp`.
3. `buildQuoteContent`'s parameter and return types carry no e-mail slot (`quote-payload.ts:61-106`), asserted over serialised bytes in `quote-payload.test.ts:81-94`.
4. Drafts store `content` without `totals`; only approval computes them (`approve.ts:91`).
5. Hydration sorts teeth and seeds the general-item counter past the highest stored `g-<n>` (`QuoteEditor.tsx:43-48`, `:63-65`, `:72`).
6. `readOnly` threads through `ToothRow`, `VisitList` and `GeneralItems`; no mutating control survives for an approved quote.
7. The list does not select `content` (`admin/index.astro:44-47`).
8. Nothing from "What We're NOT Doing" appears in the diff — no migration, no pagination/filter/sort/search, no middleware or dashboard change, no E2E files.

Automated criteria re-run at review time: `npm run lint` exit 0, `npx astro check` 0 errors over 76 files, `npm test` 40 passed, `npm run build` complete.

## Findings

### F1 — Double-submit could mint two permanent approved quotes

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/components/admin/QuoteEditor.tsx` — `handleApprove`, `handleSaveDraft`
- **Detail**: Both write actions guarded on a `useState` flag (`submitting` / `saving`). A second click landing in the same tick reads that flag through a stale closure and gets through. On the draft path that creates two rows for one quote — recoverable, they are deletable. On the approval path's no-`id` branch it inserts two independent `approved` rows with two different live `/p/<token>` links, and an approved row can be neither updated (`quotes_immutable`) nor deleted (`[id].ts:103` refuses anything but a draft) — so the duplicate is permanent and unretractable from inside the app. The race is inherited from S-01's approval path rather than introduced here, but this slice is what made the consequence concrete by adding the delete endpoint that refuses it.
- **Fix**: Replace both state-flag guards with a single `useRef` write lock (`inFlight`), cleared in `finally`. A ref is read directly rather than through the render closure, so the second click sees the lock. Keeps the plan's decision that approval need not go through a draft first — forcing that would have been the alternative and was explicitly rejected during planning.
- **Decision**: FIXED — `inFlight` ref added and applied to both paths; lint, typecheck, tests and build re-run green afterwards.

### F2 — The list query is unbounded

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/pages/admin/index.astro:44-47`
- **Detail**: No `limit` or pagination on the quote list.
- **Fix**: None now. Pagination is an explicit "What We're NOT Doing" item, justified by the PRD's scale (tens of quotes a year) and deferred to v2 by the roadmap's own S-03 risk note.
- **Decision**: DISMISSED — out of scope by an explicit, documented decision.

### F3 — `token` dropped from the list query

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/pages/admin/index.astro:46`
- **Detail**: The Phase 2 contract names `token` among the selected columns; the implementation selects `id, patient_email, created_at, status`. The list renders no token and the detail page fetches its own, so the column was never needed.
- **Fix**: None. The narrower select is the better implementation, and it follows the same reasoning the plan itself gives for excluding `content` — not shipping columns the page never renders. Recorded here as accepted drift rather than edited into the plan, so the record of what was planned stays intact.
- **Decision**: ACCEPTED — implementation is correct; plan text is the stale side.

## Pending

17 manual verification items (1.6–1.8, 2.5–2.8, 3.5–3.10, 4.5–4.8) require an authenticated session and are unchecked. Two manual items were verified by command and are checked: 1.5 (all four write endpoints answer 401 without a session cookie) and 2.9 (`/admin`, `/admin/quotes/new` and `/admin/quotes/<id>` all 302 to `/auth/signin` when signed out).

Noted during that check, not a finding: Astro's built-in CSRF guard rejects a `DELETE` carrying no `Origin` header with 403 before the handler runs. Browsers always send `Origin` on a same-origin `fetch`, so `DeleteQuoteButton` is unaffected; only header-less tooling sees it.
