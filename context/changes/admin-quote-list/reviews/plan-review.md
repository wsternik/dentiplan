<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Admin Quote List & Draft Lifecycle (S-03)

- **Plan**: `context/changes/admin-quote-list/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-04
- **Verdict**: REVISE → SOUND after fixes
- **Findings**: 1 critical, 2 warnings, 1 observation

## Verdicts

| Dimension             | Verdict                  |
| --------------------- | ------------------------ |
| End-State Alignment   | FAIL → PASS after F1, F2 |
| Lean Execution        | PASS                     |
| Architectural Fitness | PASS                     |
| Blind Spots           | PASS                     |
| Plan Completeness     | WARNING → PASS after F3  |

## Grounding

8/8 paths ✓, 4/4 symbols ✓, brief↔plan ✓, `## Progress` mechanically consistent (4/4 phases matched, every Success Criteria bullet enumerated, one `## Progress` heading, zero checkboxes in phase bodies) ✓. Contract surfaces: the plan touches `F-01 — Quotes Data Foundation` and the `content`-is-patient-visible invariant; it reports both accurately and proposes no rename or schema change.

## Findings

### F1 — Nothing routes the dentystka to `/admin`

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Desired End State; Phase 2
- **Detail**: The plan's end state opens with "A dentystka signs in and **lands on** `/admin`". `grep -rn "/admin" src` returns three hits — `src/middleware.ts:4` (the route guard), `src/components/admin/QuoteEditor.tsx:164` (the approval `fetch` URL) and the page itself. There is no navigation and no link from anywhere. `src/pages/api/auth/signin.ts:19` redirects to `/` on success, and `/dashboard` is untouched scaffold. The panel is reachable only by typing the address by hand, and no phase changed that. A last-mile gap: the plan builds the feature and stops one line short of making it findable.
- **Fix A ⭐ Recommended**: Add a fifth change to Phase 2 — redirect a successful sign-in to `/admin` instead of `/` in `src/pages/api/auth/signin.ts`.
  - Strength: One line, and it is precisely what the stated end state already claims. Leaves `/dashboard` alone — it is scaffold, not a product surface, and removing it is not this slice's business.
  - Tradeoff: Touches an auth file this slice otherwise does not enter.
  - Confidence: HIGH — the redirect target is a single literal at `signin.ts:19`; no other caller depends on it.
  - Blind spot: None significant.
- **Fix B**: Leave routing alone and soften the end state to "navigates to `/admin`".
  - Strength: Zero code outside the slice's own surface.
  - Tradeoff: Ships a panel the user cannot find; documents the gap instead of closing it.
  - Confidence: HIGH — but it resolves the contradiction in the wrong direction.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — Phase 2 gained change #5 (`src/pages/api/auth/signin.ts`); criterion 2.5 now reads "Signing in lands directly on `/admin`".

### F2 — Phase 2 links to a route that Phase 3 creates

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 2, change #2 (quote list page)
- **Detail**: The list contract said "Each row links to `/admin/quotes/<id>`", but `src/pages/admin/quotes/[id].astro` is created in Phase 3. One commit per phase means a commit in which every row on the list leads to a 404, and Phase 2's manual criteria never open a row, so nothing would catch it.
- **Fix**: Phase 2 renders identifiers as plain text; Phase 3 gains an explicit change that turns them into links, landing together with the route they point at.
- **Decision**: FIXED — Phase 2's contract now states rows are not yet clickable and why; Phase 3 gained change #4 plus criterion 3.6.

### F3 — The "zero rows → 409" guard cannot detect zero rows

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, changes #4 and #5; Critical Implementation Details
- **Detail**: Three guards rest on distinguishing "updated one row" from "matched nothing": `PUT` on a draft, `DELETE` on a draft, and approval by `id`. `supabase.from(...).update(...).eq(...)` does not report an affected-row count on its own — without a chained `.select()` (or `{ count: "exact" }`) it resolves with `data: null` and no error whether it hit one row or none. Implemented as written, each guard answers 200 to an attempt to modify an approved quote — the exact FR-053 hole this slice exists to close, reduced to a decorative `.eq()`.
- **Fix**: State the requirement in Critical Implementation Details — all three scoped statements chain `.select("id")` and treat an empty array as the 409 case.
- **Decision**: FIXED — new paragraph in Critical Implementation Details ("A scoped statement reports nothing unless you ask it to").

### F4 — `ApprovalConfirmation` does not fit the read-only mode

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 4, change #1
- **Detail**: Phase 4 proposed "reusing the `ApprovalConfirmation` presentation rather than inventing a second one". The component requires an `onReset` prop and renders the heading "Kosztorys zatwierdzony" plus a "Nowy kosztorys" reset button (`src/components/admin/ApprovalConfirmation.tsx`) — correct immediately after an approval, misleading when reopening an old quote from the list.
- **Fix**: Lift the copy control (read-only input + "Kopiuj link" button) into a small shared component both views use, instead of bending the confirmation view to two purposes.
- **Decision**: NOTED IN PLAN — observations are outside this slice's one-round critical/warning fix rule, so the guidance was written into Phase 4's contract for the implementer rather than restructuring the phase.

## Triage Summary

```
  Fixed:     F1 (Fix A), F2, F3   (3)
  Noted:     F4                   (1)

  ► Verdict after fixes: SOUND
```
