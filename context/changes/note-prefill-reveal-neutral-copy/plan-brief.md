# Reveal the form after a note prefill + neutral clinic copy — Plan Brief

> Full plan: `context/changes/note-prefill-reveal-neutral-copy/plan.md`

## What & Why

Two small changes in one unit of work. First: on the new-quote route the manual form is
collapsed behind a disclosure, and "Wypełnij z notatki" fills it without opening it — the
dentystka clicks, sees nothing, and has to discover that her result is hidden one click
away. A successful prefill should reveal the form. Second: the docs and one data comment
name a specific practice and town; the repo describes a product for _a_ dental practice,
and the name carries no product meaning.

## Starting Point

`QuoteEditor` keeps `manualFormOpen` false on `/admin/quotes/new` (note-first flow) and
`handlePrefill` only writes the merged tree and warnings. The practice name is in six
tracked files: README, PRD, shape-notes, the `pricing.json` `$comment`, and two archived
plan documents.

## Desired End State

A successful prefill leaves the form expanded with the prefilled teeth on screen; a failed
prefill still changes nothing (FR-013). No tracked file names the practice or its town, and
every sentence that mentioned it reads generically without losing meaning.

## Key Decisions Made

| Decision                 | Choice                                                              | Why                                                                                                       |
| ------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| What triggers the reveal | A successful prefill, not a non-empty note field                    | Confirmed with the user; opening on the first keystroke would defeat the note-first layout                |
| Failure path             | Unchanged — form stays collapsed                                    | FR-013: the prefill is never a gate, and a failure has nothing to reveal                                  |
| Focus / scroll           | Untouched                                                           | An unexpected jump is its own defect                                                                      |
| How to prove it          | New Playwright spec with `page.route()` stubbing the parse endpoint | No component-test harness exists (vitest is node-env, pure modules); stubbing avoids an LLM call          |
| Archived documents       | Included in the rename                                              | Proper noun → generic noun changes no meaning, and skipping them would defeat the change in a public repo |

## Scope

**In scope:** the reveal in `handlePrefill`; one new E2E spec; generic wording in README,
PRD, shape-notes, `pricing.json` `$comment`, and two archived plan documents.

**Out of scope:** opening on note input; auto-scroll/focus; re-collapsing on later failure;
disclosure copy and note-first layout; git history rewrite; renaming the product or project.

## Architecture / Approach

Phase 1 is one state write in the existing success branch of `handlePrefill` plus the spec
that pins it. Phase 2 is a prose pass over disjoint files. Nothing shared, so review can
take them separately.

## Phases at a Glance

| Phase             | What it delivers                                                          | Key risk                                                         |
| ----------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1. Prefill reveal | Successful prefill expands `#quote-details`, proven by a stubbed E2E spec | The stub's `PrefillResult` shape drifting from the real endpoint |
| 2. Neutral copy   | No practice name in tracked files                                         | A clumsy rewrite that leaves a sentence dangling                 |

**Prerequisites:** clean `main` (`134a89e`), local Supabase-backed dev server for E2E.
**Estimated effort:** one session, two commits.

## Open Risks & Assumptions

- The stubbed spec asserts the app's behaviour, not the endpoint's contract; if the real
  `PrefillResult` shape changes, the stub goes stale silently. Mitigated by typing the stub
  against `PrefillResult` in the spec.
- E2E runs locally only (not in CI, per the test plan), so the gate is a local green run.

## Success Criteria (Summary)

- Clicking "Wypełnij z notatki" shows the filled form immediately.
- A failed prefill still leaves the editor exactly as it was.
- `git ls-files | xargs grep -il` for the practice name and town returns nothing.
