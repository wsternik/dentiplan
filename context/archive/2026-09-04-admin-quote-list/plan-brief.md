# Admin Quote List & Draft Lifecycle (S-03) — Plan Brief

> Full plan: `context/changes/admin-quote-list/plan.md`

## What & Why

After S-01 the dentystka can build a quote and approve it, but `/admin` is a one-shot editor: leave the page and the work is gone, and there is no way back to anything already sent. This slice gives the `quotes` table the four operations its schema was designed for — save as draft, browse, edit a draft, delete a draft — and lands FR-072 (the patient's e-mail, stored admin-side), which S-01 explicitly deferred here.

## Starting Point

F-01 already provisioned everything this needs: `status` defaulting to `draft`, a nullable `patient_email` that nothing writes today, a nullable `token`, full `authenticated` CRUD under RLS, and an index on `created_at` whose own comment names S-03 as its consumer. What is missing is entirely in the application layer — `/admin` is the editor rather than a panel, `approve.ts` is the only write path and never touches the e-mail, and `QuoteEditor` initialises from empty literals with no way to be seeded from a stored row.

## Desired End State

Signing in lands on `/admin`: a table of every quote — identifier, e-mail, date, status. From there the dentystka starts a new quote, reopens a draft to keep working, deletes one she no longer wants, or opens an approved quote and sees it exactly as composed — read-only, with its `/p/<token>` link ready to copy.

## Key Decisions Made

| Decision                    | Choice                                               | Why (1 sentence)                                                                                                                                 |
| --------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `patient_email` requirement | Optional on a draft, required to approve             | Keeps a draft a genuine work-in-progress while guaranteeing FR-070's "e-mail odbiorcy" column is never empty for a quote that was actually sent. |
| Approval entry points       | One endpoint, optional `id`                          | Keeps S-01's working direct-insert path intact and adds only a draft branch, so price freezing and totals stay in exactly one place (FR-050).    |
| Approved-quote view         | Same editor, `readOnly` mode                         | One component and one layout; a separate Astro summary view would be a second rendering of the same tree that drifts on the first change.        |
| Draft persistence trigger   | Explicit "Zapisz szkic", no autosave                 | Matches the editor's existing deliberate-action pattern; autosave would write a row for every abandoned page-open.                               |
| Payload pipeline            | Extracted to `src/lib/services/quote-payload.ts`     | Draft save needs the same validation and price re-resolution as approval minus the guards; sharing it is what stops the two paths drifting.      |
| E-mail storage location     | Own column, sibling of `content` in the request body | `get_quote_by_token` returns `content` verbatim to `anon` and the column whitelist does not inspect nested fields — this is test-plan risk #3.   |
| List scale                  | No pagination, filtering, or search                  | PRD scales this at tens of quotes per year; the roadmap defers pagination to v2.                                                                 |
| Delete confirmation         | Two-click arm in a small React island                | Deletion is unrecoverable; the repo has no dialog primitive and this does not warrant adding one.                                                |

## Scope

**In scope:** draft create/update/delete endpoints; a post-sign-in redirect to `/admin` (nothing routes there today); approval extended with an optional draft id and a required e-mail; quote list at `/admin`; editor moved to `/admin/quotes/new`; draft edit at `/admin/quotes/<id>`; read-only mode for approved quotes; a unit suite for the extracted payload service.

**Out of scope:** pagination, filtering, sorting, search; editing or versioning approved quotes (FR-053); any migration; LLM prefill (S-02); draft retention/expiry (S-04); `mailto:`, QR, print; E2E tests; auth hardening (S-05).

## Architecture / Approach

One extraction, then three routes on top of it. `approve.ts`'s inline request schema and content builder move into `src/lib/services/quote-payload.ts`, whose types have no slot for an e-mail — the patient-safe invariant becomes structural rather than conventional. `POST /api/admin/quotes` and `PUT|DELETE /api/admin/quotes/[id]` handle drafts; `POST .../approve` gains an optional `id` and, when given one, performs a single `UPDATE` scoped by `status = 'draft'` so the immutability trigger is never provoked and the approved-row constraints are never transiently violated. `/admin` is a server-rendered table with one small island for delete; `/admin/quotes/new` and `/admin/quotes/<id>` render the same `QuoteEditor` empty, seeded, or inert.

## Phases at a Glance

| Phase                                              | What it delivers                                                          | Key risk                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1. Payload service + draft endpoints               | Shared validated pipeline, C/U/D endpoints, approval accepts a draft id   | The extraction must be behaviour-preserving — the existing cost suites staying green is the evidence              |
| 2. List at `/admin`, editor to `/admin/quotes/new` | FR-070 list, delete control, new-quote route, sign-in lands on the panel  | Moving `/admin` breaks the S-01 entry point if the new route is not wired first                                   |
| 3. Draft save + reopen for editing                 | C and U closed in the UI; e-mail gate on approval; list rows become links | Rehydration must restore tooth order and general-item ids or a reopened draft silently differs from the saved one |
| 4. Read-only approved view                         | FR-053 visible; patient link reachable from the panel                     | `readOnly` must thread through every child or one control stays live                                              |

**Prerequisites:** none beyond `main` — F-01, F-02, and S-01 are archived and complete.
**Estimated effort:** one session across four phases, one commit each.

## Open Risks & Assumptions

- The extraction of `approve.ts`'s pipeline touches the only path that freezes money. It is behaviour-preserving by intent, but nothing today tests it — the new service suite in Phase 1 is what turns that assumption into a check, and it is why the extraction leads rather than trails the phases.
- Approved rows created by S-01 carry `patient_email IS NULL` and cannot be backfilled (immutability). The list renders a neutral placeholder for them.
- Three guards (draft `PUT`, draft `DELETE`, approve-by-id) rest on detecting a zero-row statement, which Supabase reports only when `.select()` is chained. Implemented naively they answer 200 to an attempt to modify an approved quote — the plan calls this out under Critical Implementation Details.
- Risk #3 is only cheaply covered here (a unit assertion on the built `content` and a manual view-source check). The integration and E2E coverage that risk owns belongs to its own `test-plan.md` rollout phase, not to this slice.

## Success Criteria (Summary)

- The dentystka can save an unfinished quote, close the browser, come back, and continue where she left off.
- Every quote she has ever made is visible in one place with its recipient's e-mail, date, and status; drafts open editable, approved ones open read-only with their patient link.
- Nothing the patient sees at `/p/<token>` gained an e-mail address in the process.
