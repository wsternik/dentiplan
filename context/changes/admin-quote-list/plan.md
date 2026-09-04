# Admin Quote List & Draft Lifecycle (S-03) Implementation Plan

## Overview

S-03 closes the admin panel's lifecycle gap. After S-01 a dentystka can build a quote and approve it, but the moment she leaves the page the work is gone and she has no way back to anything she has already sent — `/admin` is a one-shot editor with no memory. This slice gives the `quotes` table the four operations its schema was designed for: save a quote as a `draft` (C), browse every quote from a list at `/admin` (R), reopen and edit a draft (U), and delete a draft (D). Approved quotes stay reachable but read-only, per FR-053.

It also lands FR-072, which S-01 explicitly deferred: the patient's e-mail, stored beside the quote for the dentystka's own reference. Without it the list's "e-mail odbiorcy" column that FR-070 promises has nothing to show.

No migration is required. F-01 provisioned the whole surface this slice needs — `status`, `patient_email`, a nullable `token`, full `authenticated` CRUD under RLS, and an index on `created_at` whose own comment names this slice as its consumer.

## Current State Analysis

**Schema (`supabase/migrations/20260603194110_quotes_foundation.sql`) — complete for this slice:**

- `quotes.status` defaults to `'draft'`; the `draft`/`approved` check constraint is already in place.
- `quotes.patient_email` — `text`, nullable, written by nothing today.
- `quotes.token` — nullable until approval; the partial unique index only covers non-null tokens, so any number of drafts can coexist with `token IS NULL`.
- Constraints `quotes_approved_has_token` and `quotes_approved_has_timestamp` fire only when `status = 'approved'`, so a draft row legitimately carries both as `NULL`.
- RLS grants `authenticated` all four operations with `using (true)` — no policy work needed.
- `quotes_created_at_idx` exists and its inline comment reads "serves the admin list ordering (S-03)".
- Trigger `quotes_immutable` keys on `OLD.status`: it blocks UPDATE of an already-`approved` row and lets the one-time `draft → approved` transition through. `DELETE` is deliberately unguarded.

**Application layer — the gaps:**

- `src/pages/admin/index.astro` **is** the editor, not a panel. It resolves pricelist picker options server-side and renders `<QuoteEditor client:load>`. A list at `/admin` must displace it.
- `src/pages/api/admin/quotes/approve.ts` is the only write path. It performs a single `INSERT` of an already-`approved` row and never touches `patient_email`. Its header comment warns against "INSERT-draft-then-UPDATE" — a warning about _approving via a second UPDATE of an approved row_, not about the legal `draft → approved` transition.
- `src/components/admin/QuoteEditor.tsx` initialises all state from empty literals (`useState<ToothEntry[]>([])` and friends) and has no way to be seeded from a stored quote. It also has no notion of being non-editable.
- The whole payload → `content` pipeline (Zod request schema, per-id price re-resolution, patient-safe tree construction) lives inline inside `approve.ts`. Draft save needs the same pipeline minus the approval guards.
- No `src/lib/services/` directory exists yet, though `CLAUDE.md` designates it for extracted business logic.

### Key Discoveries:

- **The immutability trigger permits exactly what this slice needs.** `prevent_approved_update()` raises only when `OLD.status = 'approved'`, so updating a draft — including flipping it to `approved` — passes (`supabase/migrations/20260603194110_quotes_foundation.sql:89`). No schema change, no trigger change.
- **S-01's plan explicitly parked this work here.** Its "What We're NOT Doing" names FR-070/071 ("no quote list, open-from-list, or read-only re-open") and FR-072 ("no patient-email field / storage") as S-03 (`context/archive/2026-06-04-first-thin-quote-and-patient-link/plan.md:56`). This slice is the other side of that hand-off.
- **`patient_email` must never enter `content`.** `get_quote_by_token` returns the entire `content` jsonb verbatim to `anon`; the column whitelist protects only top-level columns and does not inspect nested fields (`docs/reference/contract-surfaces.md`, "Invariant"). Risk #3 in `context/foundation/test-plan.md` is precisely this failure — "the patient page shows … the e-mail the dentist stored for her own reference" — and it cites FR-072, the requirement this slice implements. The e-mail therefore travels as a sibling of `content` in the request body and lands in its own column, never inside the tree.
- **`QuoteTotals` is optional by design.** `QuoteContentSchema` marks `totals` optional and `src/types.ts` documents it as "present only once S-01 has computed them". Drafts consequently store `content` without `totals`; the editor recomputes live on load and approval writes the authoritative frozen value.
- **Item names are not globally unique** (`docs/reference/contract-surfaces.md`, F-02). The list must identify quotes by something stable — `id` and `created_at` — not by derived content.
- **The picker options are derived server-side and are identical for every quote** (`src/pages/admin/index.astro`). Three routes now need them, so the derivation moves to a shared module rather than being copy-pasted per page.

## Desired End State

A dentystka signs in and lands on `/admin`, a table of every quote she has made: identifier, patient e-mail, creation date, status. From there she can start a new quote (`/admin/quotes/new`), reopen a draft to keep working on it (`/admin/quotes/<id>`), delete a draft she no longer wants, or open an approved quote and see it exactly as she composed it — read-only, with its `/p/<token>` link ready to copy. Approval still freezes prices server-side and produces an immutable row; the only new thing is that it can now start from a stored draft instead of only from an unsaved editor.

**Verification:** `npm run lint`, `npx astro check`, and `npm test` pass; the new payload-builder suite proves the e-mail never reaches `content`; a manual pass creates a draft, reloads it, edits it, approves it, confirms the approved row is read-only and its patient link works, and deletes a second draft.

## What We're NOT Doing

- **No pagination, filtering, sorting controls, or search** on the list. The PRD scales this at "kilkadziesiąt kosztorysów rocznie" and the roadmap defers pagination to v2 (`context/foundation/roadmap.md`, S-03 Risk).
- **No editing of approved quotes, and no versioning.** FR-053 stands: editing after approval means a new quote with a new token.
- **No migration and no schema change.** F-01 already provides everything.
- **No LLM prefill** (S-02, `blocked` on the provider decision).
- **No retention or expiry of drafts** (S-04). A draft lives until deleted by hand.
- **No `mailto:`, QR code, print view, or any send-from-the-app affordance.** Parked in the PRD Non-Goals; the dentystka copies the link herself (FR-052).
- **No change to `patient_email`'s optionality in the domain sense** — it stays a nullable column; the requirement is enforced in the approval path, not in the schema.
- **No E2E tests.** The `test-plan.md` phase that owns risks #3/#4 end-to-end is a separate change; this slice contributes only the cheap unit-level guard at the payload builder.
- **No auth hardening** (S-05) and **no `anon` access changes**. The patient RPC is untouched.

## Implementation Approach

The work splits along a clean seam: everything the server needs to turn a request body into a stored row is extracted first, then the three routes are built on top of it.

**Extraction first.** `approve.ts` currently owns the request schema, the by-id price re-resolution, and the patient-safe tree construction. Draft save needs all of that and none of the approval guards. So it moves into `src/lib/services/quote-payload.ts` as a pure, testable function, and both write paths call it. This is also where the e-mail/`content` separation becomes a structural property rather than a convention: the builder's return type has no slot for an e-mail, so no caller can accidentally nest one.

**One approval endpoint, two entry branches.** `POST /api/admin/quotes/approve` gains an optional `id`. Absent, it does what it does today — a single `INSERT` of an already-`approved` row, keeping S-01's working path (and its manual verification) intact. Present, it re-validates the payload, then `UPDATE`s that row to `approved` with a freshly generated token and `approved_at`, guarded by `status = 'draft'` in the `WHERE` clause so a concurrent approval cannot double-approve and so the trigger is never provoked. Price freezing and totals computation stay in exactly one place.

**One editor, three modes.** `QuoteEditor` gains an optional initial state and a `readOnly` flag. `/admin/quotes/new` renders it empty; `/admin/quotes/<id>` renders it seeded from the stored row, editable for a draft and inert for an approved one. The alternative — a second, Astro-rendered summary view for approved quotes — would mean two renderings of the same tree that drift apart on the first change.

**The list is server-rendered.** `/admin` fetches rows in Astro and renders a plain table; only the delete action, which needs a confirmation step and a `fetch`, is a small React island.

## Critical Implementation Details

**Ordering of the approval UPDATE.** The `draft → approved` transition must set `status`, `token`, `approved_at`, and the frozen `content` in a _single_ statement. Two statements would leave the row `approved` with a `NULL` token in between, violating `quotes_approved_has_token`, and the second statement would then be rejected by `quotes_immutable` — leaving a permanently broken row that FR-053 makes uncorrectable. Scope the update with `.eq("id", id).eq("status", "draft")` and treat a zero-row result as "already approved or gone", not as success.

**A scoped statement reports nothing unless you ask it to.** Three guards in this plan — `PUT` on a draft, `DELETE` on a draft, and approval by `id` — depend on distinguishing "updated one row" from "matched nothing because the row is already approved or gone". `supabase.from(...).update(...).eq(...)` does **not** return an affected-row count on its own: without a chained `.select("id")` (or `{ count: "exact" }`) the call resolves with `data: null` and no error whether it hit one row or none. Implemented naively, every one of those guards answers 200 to an attempt to modify an approved quote — the exact FR-053 hole this slice exists to close. Chain `.select("id")` on all three and treat an empty array as the 409 case.

**The e-mail is a sibling of `content`, never a member.** Both write endpoints accept `patient_email` at the top level of the request body and pass it straight to the column. It is never an argument to the content builder. See Key Discoveries for why the RPC's column whitelist does not save us if this is violated.

**Tooth ordering on rehydration.** The editor keys tooth rows by `number` and maintains a sorted invariant when adding teeth (`addTeeth` sorts on insert). Content loaded from storage must be sorted the same way on hydration, or a draft saved after an out-of-order manual edit will render in a different order than it was composed in.

---

## Phase 1: Extract the payload service and open the draft write paths

### Overview

Move the request→`content` pipeline out of `approve.ts` into a shared, unit-tested service, then build the three draft endpoints on it and extend approval to accept a draft id. Server-side only — nothing user-visible changes yet.

### Changes Required:

#### 1. Shared payload service

**File**: `src/lib/services/quote-payload.ts` (new)

**Intent**: Own the single definition of "what an admin write request looks like" and "how it becomes a patient-safe `content` tree", so the draft and approval paths cannot drift. Extracted verbatim in behaviour from `approve.ts` — the FDI re-validation, the `note` length bound, and the by-id price re-resolution are all preserved, because they are what risk #1 in `test-plan.md` is about.

**Contract**: Exports the Zod request schema (teeth carrying `pricelistItemIds`, visits, general items carrying `itemId`, plus `patient_type`) and a builder that maps a parsed payload to `QuoteContent`. The builder's parameter and return types contain no e-mail field — the separation is enforced by the type, not by discipline. It throws on an unknown pricelist id (the existing `resolvePricelistItem` behaviour) so callers can map that to a 400. `totals` is left unset; only approval computes it.

#### 2. Payload service tests

**File**: `src/lib/services/quote-payload.test.ts` (new)

**Intent**: Pin the invariants that make this service safe to share, alongside the existing Vitest suites in `src/lib/quote/`.

**Contract**: Covers — a valid payload produces a tree whose per-tooth items carry server-resolved prices; a client-sent price is ignored in favour of the resolved one; an unknown pricelist id throws; an out-of-FDI-range tooth number is rejected; an over-long note is rejected; and, for risk #3, that an e-mail supplied anywhere in the input never appears anywhere in the serialised `content`.

#### 3. Draft collection endpoint

**File**: `src/pages/api/admin/quotes/index.ts` (new)

**Intent**: Create a new draft row from the editor's working tree.

**Contract**: `POST`, `prerender = false`. Requires an authenticated user (401 otherwise), following the `createClient(context.request.headers, context.cookies)` pattern of `approve.ts`. Body is the shared schema plus an optional `patient_email`. Inserts with `status: 'draft'`, `token: null`, `approved_at: null`, `content` from the builder, and returns `201` with the new row's `id`. Deliberately applies **no** completeness guards — an incomplete draft is the normal case.

#### 4. Draft item endpoint

**File**: `src/pages/api/admin/quotes/[id].ts` (new)

**Intent**: Update and delete a single draft.

**Contract**: `PUT` and `DELETE`, `prerender = false`, both authenticated. `PUT` takes the same body as the collection endpoint and updates `content` and `patient_email`, scoping the statement with `.eq("status", "draft")` so an approved row can never be targeted; a zero-row result returns 409 rather than a silent success. `DELETE` likewise removes only `status = 'draft'` rows, returning 409 for an approved one — FR-053 makes approved quotes immutable, and while the DB trigger guards UPDATE it deliberately leaves DELETE open for S-04 retention, so the application layer is the guard here.

#### 5. Approval accepts a draft id

**File**: `src/pages/api/admin/quotes/approve.ts`

**Intent**: Let an approval start from a stored draft while keeping the existing direct-insert path working, and land FR-072 by persisting the e-mail on the approved row.

**Contract**: Body gains an optional `id` and a now-**required** `patient_email` (a bounded, format-validated string). Behaviour splits: no `id` → the current single `INSERT`, now including `patient_email`; with `id` → one `UPDATE` scoped by `.eq("id", id).eq("status", "draft")` setting `status`, `token`, `approved_at`, `content`, and `patient_email` together, with a zero-row result returned as 409. The existing guards (empty quote, `in-plan` tooth without a pricelist item) and `computeQuoteTotals` apply to both branches. The inline schema and tree-building code are replaced by imports from the payload service.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Full unit suite passes, including the new service tests: `npm test`
- The existing cost-engine and format suites still pass unchanged: `npm test`

#### Manual Verification:

- `POST /api/admin/quotes` without a session cookie returns 401.
- Creating a draft via the endpoint stores a row with `status = 'draft'`, `token IS NULL`, and `totals` absent from `content`.
- `PUT` against an approved row's id returns 409 and leaves the row untouched.
- Approving with a draft `id` flips that same row to `approved` — no second row is created — and the DB trigger does not fire.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Quote list at `/admin`, editor moved to `/admin/quotes/new`

### Overview

Turn `/admin` into the panel FR-070 describes and give the new-quote editor its own route. This is the phase that changes what the dentystka sees first after signing in.

### Changes Required:

#### 1. Shared picker-option derivation

**File**: `src/lib/pricing/picker-options.ts` (new, exported through the `@/lib/pricing` barrel)

**Intent**: Three routes now need the resolved, category-tagged picker options that `admin/index.astro` derives today. Move the derivation to one place rather than duplicating it per page.

**Contract**: Exports a function returning `{ toothOptions, generalOptions }` as `PickerOption[]`, built from `listByCategory()` + `resolvePricelistItem()` exactly as the current page does. Re-exported from the barrel so pages keep importing from `@/lib/pricing` only, per the F-02 contract note.

#### 2. Quote list page

**File**: `src/pages/admin/index.astro`

**Intent**: Replace the editor with the list of all quotes (FR-070), the entry point to every other operation.

**Contract**: Server-side `select` of `id`, `patient_email`, `created_at`, `status`, `token` ordered by `created_at desc` (served by `quotes_created_at_idx`). Renders a table with a short identifier, the e-mail (with a neutral placeholder when a draft has none yet), a formatted date, and a status badge. Drafts carry the delete control. A "Nowy kosztorys" action links to `/admin/quotes/new`, and an empty state covers the no-quotes case. **Rows are not yet clickable** — `/admin/quotes/[id]` does not exist until Phase 3, and since each phase is a commit, linking here would ship a commit whose every row leads to a 404. Phase 3 adds the link together with the route it points at. Keeps the existing "Zalogowano: …" affordance.

#### 3. Delete control

**File**: `src/components/admin/DeleteQuoteButton.tsx` (new)

**Intent**: Deletion is destructive and unrecoverable, so it needs a confirmation step — the only interactive element on an otherwise static page, hence the only island.

**Contract**: A small React island taking the quote id. First click arms, second click issues `DELETE /api/admin/quotes/<id>` and reloads the list on success; an error is shown inline. Rendered only for `draft` rows. No new dependency — the repo has no dialog primitive and this does not warrant adding one.

#### 4. New-quote route

**File**: `src/pages/admin/quotes/new.astro` (new)

**Intent**: Give the S-01 editor a stable home now that `/admin` is the list.

**Contract**: Renders `<QuoteEditor client:load>` with options from the shared derivation, inside the existing `Layout`. Reachable under the `/admin` prefix, so `PROTECTED_ROUTES` in `src/middleware.ts` already covers it — no middleware change.

#### 5. Post-sign-in destination

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Make the panel reachable. Today `signin.ts:19` redirects to `/`, and nothing anywhere in `src/` links to `/admin` — the only references are the middleware guard, the approval `fetch` URL, and the page itself. Without this, the list exists but the dentystka can only reach it by typing the address, and the end state above is not actually met.

**Contract**: On a successful sign-in, redirect to `/admin` instead of `/`. One line; the error branches are unchanged. `/dashboard` stays as it is — it is scaffold, not a product surface, and removing it is not this slice's business.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Unit suite passes: `npm test`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Signing in lands directly on `/admin` and shows the list, not the editor.
- A previously approved quote appears with its e-mail, date, and `approved` status.
- Opening `/admin/quotes/new` renders the editor and approval still works end-to-end.
- The delete control requires two clicks, removes the draft, and does not appear on approved rows.
- Visiting `/admin` and `/admin/quotes/new` while signed out redirects to `/auth/signin`.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Draft save and reopening a draft for editing

### Overview

Close the C and U halves of the lifecycle in the UI: the editor can save what it holds, and can be rehydrated from a stored draft.

### Changes Required:

#### 1. Editor accepts initial state and a save action

**File**: `src/components/admin/QuoteEditor.tsx`

**Intent**: The editor initialises every piece of state from an empty literal today. It needs to start from a stored quote instead, hold the patient e-mail, and be able to persist itself as a draft.

**Contract**: Props gain an optional quote id, an optional initial `QuoteContent` + `patient_type` + `patient_email`, and the component gains a `patientEmail` state field with an input. A "Zapisz szkic" action `POST`s to the collection endpoint when there is no id (then adopts the returned id, so a second save updates rather than duplicating) and `PUT`s to the item endpoint when there is. Save is explicit — no autosave; the editor's existing deliberate-action pattern is the one to follow, and an autosave would write a row for every abandoned page-open. Saving state (in-flight, saved-at, error) is surfaced next to the button. On hydration the tooth array is sorted by number, and the general-item counter is seeded past the highest stored id so new items cannot collide with restored ones.

#### 2. Approval gains the e-mail requirement

**File**: `src/components/admin/QuoteEditor.tsx`

**Intent**: Enforce the decision that the e-mail is optional for a draft but required to approve, so FR-070's "e-mail odbiorcy" column is never empty for a quote that has actually been sent.

**Contract**: The existing `approveDisabled` / `approveReason` gating gains a third condition for a missing or malformed e-mail, mirroring the server-side requirement added in Phase 1. The approval payload gains `patient_email` and, when the editor was loaded from a draft, that draft's `id`.

#### 3. Draft edit route

**File**: `src/pages/admin/quotes/[id].astro` (new)

**Intent**: Serve FR-071 — open any quote from the list.

**Contract**: Fetches the row by id server-side; a miss renders a not-found state. Parses `content` through `QuoteContentSchema` before handing it to the island, so a malformed stored tree fails at the boundary rather than inside React. Passes id, content, `patient_type`, and `patient_email` into `<QuoteEditor client:load>`. Approved rows are handled in Phase 4; until then they render the same editable view — harmless, because both write endpoints are scoped to `status = 'draft'` and reject the attempt server-side.

#### 4. Link the list rows

**File**: `src/pages/admin/index.astro`

**Intent**: Complete what Phase 2 deliberately left open — now that the route exists, the list identifier becomes the link to it (FR-071).

**Contract**: The identifier cell becomes an anchor to `/admin/quotes/<id>` for every row, draft and approved alike.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Unit suite passes: `npm test`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Filling part of a quote, saving it as a draft, and returning to `/admin` shows it as `draft`.
- Every row in the list is now clickable and opens the right quote.
- Reopening that draft restores every field — teeth in the same order, visits, general items, general-item ids, patient type, e-mail.
- Editing and saving again updates the same row rather than creating a second one.
- "Zatwierdź" stays disabled with an explanatory message until a valid e-mail is entered.
- Approving a reopened draft produces a working `/p/<token>` link and leaves exactly one row.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Read-only view of approved quotes

### Overview

Make FR-053 visible in the UI: an approved quote can be opened and inspected but not altered, and its patient link is available from there.

### Changes Required:

#### 1. Read-only mode in the editor tree

**Files**: `src/components/admin/QuoteEditor.tsx`, `ToothRow.tsx`, `VisitList.tsx`, `GeneralItems.tsx`, `PricelistPicker.tsx`

**Intent**: Render an approved quote in the same layout the dentystka composed it in, with every mutating control unavailable.

**Contract**: A `readOnly` flag threads down through the child components; inputs, selects, and pickers become disabled and the add/remove affordances are not rendered. The totals preview stays visible. In the editor shell, "Zapisz szkic" and "Zatwierdź" are replaced by the quote's `/p/<token>` link with the existing copy affordance. Note that `ApprovalConfirmation` cannot be reused wholesale: it requires an `onReset` prop and renders "Kosztorys zatwierdzony" plus a "Nowy kosztorys" button — right after an approval, wrong when reopening an old quote from the list. Lift the copy control (read-only input + "Kopiuj link" button) into a small shared component both can use, rather than duplicating it or bending the confirmation view to two purposes. The raw-diagnosis scratch textarea is hidden — it was never persisted and would render misleadingly empty.

#### 2. Route dispatches on status

**File**: `src/pages/admin/quotes/[id].astro`

**Intent**: Send drafts to the editable view and approved quotes to the read-only one.

**Contract**: Passes `readOnly` and the row's `token` into the island when `status === 'approved'`. The e-mail is shown as static text in that mode.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Unit suite passes: `npm test`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Opening an approved quote from the list shows every field populated and no control that mutates it.
- The `/p/<token>` link is present, copyable, and opens the correct patient page.
- The patient page for that quote still contains no e-mail address (view source, not just the rendered page) — the risk #3 check at the level this slice can cheaply reach.
- A draft opened from the same route is still fully editable.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- `src/lib/services/quote-payload.test.ts` — the new suite. Server-side price re-resolution wins over any client-sent price; unknown pricelist id throws; out-of-FDI-range tooth number and over-long note are rejected; and the risk #3 guard: no e-mail present in the input reaches the built `content`.
- Existing `src/lib/quote/cost.test.ts` and `format.test.ts` must keep passing untouched — the extraction is behaviour-preserving, and their staying green is the evidence for that.

### Integration Tests:

None in this slice. The `test-plan.md` rollout phase that owns risks #3 and #4 at the integration and E2E level is a separate change with its own change folder; duplicating a thin version here would create a second, weaker assertion in a place nobody would look for it.

### Manual Testing Steps:

1. Sign in; confirm `/admin` shows the list with the pre-existing approved quote from S-01.
2. Start a new quote, fill part of it, save as draft without an e-mail; confirm it appears in the list as `draft` with an empty e-mail cell.
3. Reopen the draft; confirm every field round-tripped, including tooth order and general-item ids.
4. Confirm "Zatwierdź" is disabled and explains why until a valid e-mail is entered.
5. Approve; confirm the row count did not grow, the status flipped, and the `/p/<token>` link works.
6. Reopen the now-approved quote; confirm it is read-only and exposes the patient link.
7. View source on `/p/<token>`; confirm the e-mail appears nowhere in the response body.
8. Create a second draft, delete it from the list, confirm the two-click confirmation and that it disappears.
9. Sign out; confirm `/admin`, `/admin/quotes/new`, and `/admin/quotes/<id>` all redirect to `/auth/signin`.

## Performance Considerations

The list is unpaginated by decision. At the PRD's stated scale (tens of quotes per year) a full `select` ordered by `created_at` is served directly by `quotes_created_at_idx` and needs nothing more. The row shape is deliberately narrow — `content` is **not** selected for the list, so the page never ships quote trees it does not render.

## Migration Notes

No migration. Existing approved rows from S-01 carry `patient_email IS NULL`; they render with a neutral placeholder in the list and are otherwise unaffected. The e-mail requirement applies to new approvals only — approved rows are immutable, so backfilling is neither possible nor wanted.

## References

- Roadmap slice: `context/foundation/roadmap.md` — S-03 `admin-quote-list`
- Requirements: `context/foundation/prd.md` — FR-070, FR-071, FR-072, FR-053
- Risk map: `context/foundation/test-plan.md` — risk #3 (admin-only e-mail must never reach the patient page)
- Contract registry: `docs/reference/contract-surfaces.md` — `content` patient-visible invariant, `quotes` column list
- Prior slice that deferred this work: `context/archive/2026-06-04-first-thin-quote-and-patient-link/plan.md`
- Immutability trigger: `supabase/migrations/20260603194110_quotes_foundation.sql:89`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Extract the payload service and open the draft write paths

#### Automated

- [x] 1.1 Linting passes: `npm run lint` — 734e2c9
- [x] 1.2 Type checking passes: `npx astro check` — 734e2c9
- [x] 1.3 Full unit suite passes, including the new service tests: `npm test` — 734e2c9
- [x] 1.4 The existing cost-engine and format suites still pass unchanged: `npm test` — 734e2c9

#### Manual

- [ ] 1.5 `POST /api/admin/quotes` without a session cookie returns 401
- [ ] 1.6 Creating a draft stores `status = 'draft'`, `token IS NULL`, no `totals` in `content`
- [ ] 1.7 `PUT` against an approved row's id returns 409 and leaves the row untouched
- [ ] 1.8 Approving with a draft `id` flips that row to `approved` without creating a second row

### Phase 2: Quote list at `/admin`, editor moved to `/admin/quotes/new`

#### Automated

- [x] 2.1 Linting passes: `npm run lint` — d8e1c0f
- [x] 2.2 Type checking passes: `npx astro check` — d8e1c0f
- [x] 2.3 Unit suite passes: `npm test` — d8e1c0f
- [x] 2.4 Production build succeeds: `npm run build` — d8e1c0f

#### Manual

- [ ] 2.5 Signing in lands directly on `/admin`, which shows the list, not the editor
- [ ] 2.6 A previously approved quote appears with e-mail, date, and `approved` status
- [ ] 2.7 `/admin/quotes/new` renders the editor and approval still works end-to-end
- [ ] 2.8 Delete requires two clicks, removes the draft, absent on approved rows
- [ ] 2.9 `/admin` and `/admin/quotes/new` redirect to `/auth/signin` when signed out

### Phase 3: Draft save and reopening a draft for editing

#### Automated

- [x] 3.1 Linting passes: `npm run lint` — 5f1e1ac
- [x] 3.2 Type checking passes: `npx astro check` — 5f1e1ac
- [x] 3.3 Unit suite passes: `npm test` — 5f1e1ac
- [x] 3.4 Production build succeeds: `npm run build` — 5f1e1ac

#### Manual

- [ ] 3.5 A partially filled quote saves as a draft and appears in the list
- [ ] 3.6 Every row in the list is now clickable and opens the right quote
- [ ] 3.7 Reopening restores every field, tooth order, and general-item ids
- [ ] 3.8 Saving again updates the same row rather than creating a second one
- [ ] 3.9 "Zatwierdź" stays disabled with a message until a valid e-mail is entered
- [ ] 3.10 Approving a reopened draft yields a working `/p/<token>` and exactly one row

### Phase 4: Read-only view of approved quotes

#### Automated

- [x] 4.1 Linting passes: `npm run lint`
- [x] 4.2 Type checking passes: `npx astro check`
- [x] 4.3 Unit suite passes: `npm test`
- [x] 4.4 Production build succeeds: `npm run build`

#### Manual

- [ ] 4.5 An approved quote opens fully populated with no mutating control
- [ ] 4.6 The `/p/<token>` link is present, copyable, and opens the correct patient page
- [ ] 4.7 The patient page response body contains no e-mail address
- [ ] 4.8 A draft opened from the same route is still fully editable
