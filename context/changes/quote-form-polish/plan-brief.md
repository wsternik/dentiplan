# Save diagnosis notes and simplify the quote form — Plan Brief

> Full plan: `context/changes/quote-form-polish/plan.md`

## What & Why

Dentists should begin a new quote by pasting a diagnosis note, then open the detailed form only when manual correction is useful. The raw note is retained with the quote for the authenticated dentist, but is never part of patient-visible `content` or the anonymous patient RPC.

## Starting Point

The quote editor already parses a transient note, auto-saves drafts, and passes `patient_email` through a dedicated nullable column. Approved quote `content` is immutable and deliberately serves the patient page verbatim.

## Desired End State

A new quote starts with a prominent note and a collapsed manual form. The saved note is readable in the panel after approval, never in an anonymous patient response, and the rest of the editor reads as a concise summary rather than a frozen form.

## Key Decisions Made

| Decision                 | Choice                                     | Why                                                                      |
| ------------------------ | ------------------------------------------ | ------------------------------------------------------------------------ |
| Note storage             | Nullable `quotes.diagnosis_note` column    | Prevents raw medical text from crossing the `content` boundary.          |
| Privacy check            | Unit schema guard plus anonymous E2E probe | Tests both the serializer and the actual public surface.                 |
| General anaesthesia copy | Polish UI says “narkoza” only              | Keeps the unrelated local-anaesthesia price item and identifiers intact. |
| Form disclosure          | Collapse only when creating a new draft    | Existing drafts and approved quotes must remain directly readable.       |

## Scope

**In scope:** copy, database/API persistence, note-first creation, loading overlay, read-only rendering, chart layout/FDI labels, two accessible information hints, and documentation.

**Out of scope:** note editing after approval, note search/history, aborting a prefill request, patient-side notes, broad tooltip rollout, and changing local-anaesthesia names or identifiers.

## Architecture / Approach

Persist the note alongside `patient_email`; let payload schemas strip it before `buildQuoteContent`, while the anonymous RPC remains unchanged. The editor supplies the note to draft and approval requests, and panel-only reads select it explicitly.

## Phases at a Glance

| Phase              | What it delivers                                      | Key risk                                          |
| ------------------ | ----------------------------------------------------- | ------------------------------------------------- |
| 1. Vocabulary      | “Narkoza” display copy and exact test updates         | Accidentally renaming local anaesthesia           |
| 2. Private note    | Migration, APIs, panel read, privacy tests            | Medical text leaking into public payload          |
| 3. Note-first form | Collapsed manual form on new drafts                   | Hiding editable data at the wrong lifecycle state |
| 4. Editor polish   | Layout, accessible hints, overlay, chart/read-only UI | Print and accessibility regression                |
| 5. Documents       | PRD, roadmap, test-plan and migration note            | Documentation claiming unverified behaviour       |

**Prerequisites:** branch starts at `239693d`; Supabase project must be linked and migration application recorded before phase 2 is complete.

## Open Risks & Assumptions

- The local Supabase CLI is currently unlinked, so applied remote migrations need confirmation before adding the second migration.
- Patient privacy is a security boundary, not an inference from column names; automated checks must prove it.

## Success Criteria (Summary)

- A saved diagnosis note is panel-only for draft and approved quotes.
- New quotes are note-first; parsing visibly blocks form interaction without blocking scroll.
- Unit, lint, build, and unchanged-contract E2E coverage pass, with the documented two-string E2E exception only.
