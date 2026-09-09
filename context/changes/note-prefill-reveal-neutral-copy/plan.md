# Reveal the form after a note prefill + neutral clinic copy — Implementation Plan

## Overview

Two small, independent changes to the same repo, shipped as one unit of work:

1. **Prefill reveal.** On `/admin/quotes/new` the manual form is collapsed behind a
   disclosure button ("Dostosuj formularz ręcznie"). "Wypełnij z notatki" fills the
   working tree from the diagnosis note but leaves that disclosure closed, so the
   dentystka sees nothing happen and has to guess that the result is hidden one click
   away. A successful prefill should open the form.
2. **Neutral clinic copy.** Product docs and one data comment name a specific practice
   and town. The repo is meant to describe a product for _a_ dental practice, not to
   identify one; the name carries no product meaning and the repo is public.

## Current State Analysis

- `src/components/admin/QuoteEditor.tsx:125-126` — `noteFirst` is `true` only for the
  new-quote route (`!quoteId && !readOnly`); `manualFormOpen` starts `false` there and
  `true` for reopened drafts and approved quotes.
- `src/components/admin/QuoteEditor.tsx:386-411` — `handlePrefill()` posts to
  `/api/admin/quotes/parse`, and on success calls `setParseWarnings(applyPrefill(result))`.
  `applyPrefill` replaces teeth/visits/generalItems. Nothing touches `manualFormOpen`.
- `src/components/admin/QuoteEditor.tsx:566-579` — the disclosure button (`aria-expanded`,
  `aria-controls="quote-details"`) and the `hidden={!manualFormOpen}` container.
- On the failure path (`res.ok === false` or a thrown fetch) the editor sets `parseError`
  and changes nothing else — FR-013: the prefill is never a gate.
- `e2e/quote-form-disclosure.spec.ts` pins the collapsed-by-default behaviour and the
  reopened-draft behaviour. It never calls the prefill, so it is unaffected.
- No component-level test harness exists: `vitest.config.ts` runs `environment: "node"`
  over pure modules only. Component behaviour in this repo is covered by Playwright.
- Clinic name appears in exactly six tracked files (`git ls-files | xargs grep -il`):
  `README.md:17`, `context/foundation/prd.md:26,34`, `context/foundation/shape-notes.md:11,45,52,60,274`,
  `src/lib/pricing/data/pricing.json:2` (`$comment`), and two files under
  `context/archive/2026-06-03-pricelist-seed-foundation/`.

## Desired End State

- A successful "Wypełnij z notatki" leaves the form expanded, with the prefilled teeth
  and visits on screen and the disclosure button reading "Ukryj formularz ręcznie"
  (`aria-expanded="true"`). A failed prefill leaves the form exactly as it was.
- The reveal is unconditional on success: if the dentystka collapses the form again and runs
  another prefill, it reopens. It is a `true` write, not a toggle and not a remembered preference.
- No tracked file names the practice or its town. Prose reads generically
  ("gabinet stomatologiczny", "the dentist running a single-practice clinic").
- `npm run test`, `npm run lint`, `npm run build` and `npm run test:e2e` all green, with
  no edits to existing E2E specs.

### Key Discoveries:

- The reveal is one state write in an existing success branch — no new state, no effect.
  Putting it next to `setParseWarnings` keeps "what a successful prefill does" in one place.
- `page.route()` lets a new E2E spec stub `/api/admin/quotes/parse` with a canned
  `PrefillResult` (`src/lib/llm/schema.ts:80`), so the reveal is provable without spending
  an LLM call and without CI-visible flakiness.
- Archived plan documents also carry the name. They are a historical record, but the
  substitution is a proper noun → generic noun with no change of meaning, and leaving them
  would defeat the point of the change in a public repo.

## What We're NOT Doing

- Not opening the form merely because the note textarea is non-empty — the reveal is tied
  to a _successful prefill_ (confirmed with the user).
- Not auto-scrolling or moving focus after the reveal; an unexpected jump is its own defect.
- Not re-collapsing the form on a later failed prefill.
- Not touching the disclosure copy, the note-first layout, or the `Section` order.
- Not rewriting git history — the name stays in old commit messages/diffs.
- Not renaming the product, the repo, the Supabase project, or any deployment.

## Implementation Approach

Phase 1 is a component change plus the E2E spec that proves it. Phase 2 is a prose pass.
They touch disjoint files, so review can treat them separately.

## Phase 1: Reveal the form after a successful prefill

### Overview

A successful prefill expands `#quote-details`; a failed one changes nothing.

### Changes Required:

#### 1. Prefill success branch

**File**: `src/components/admin/QuoteEditor.tsx`

**Intent**: After `applyPrefill` writes the merged tree, open the manual form so the result
is visible. Only the success branch; the two failure paths stay untouched (FR-013).

**Contract**: `manualFormOpen` becomes `true` inside `handlePrefill`'s success branch. No
change to its initial value, to `noteFirst`, or to the disclosure button's markup — the
button label and `aria-expanded` already derive from `manualFormOpen`.

#### 2. E2E coverage

**File**: `e2e/quote-prefill-reveal.spec.ts` (new)

**Intent**: Prove the reveal without an LLM call: stub `POST /api/admin/quotes/parse` via
`page.route()` and assert the disclosure state before and after.

**Contract**: The stub returns a `PrefillResult` (`{ content: { teeth, visits, generalItems }, warnings }`)
whose teeth match `ToothEntry` in `src/components/admin/types.ts`. Asserts: `aria-expanded="false"`
before; after clicking "Wypełnij z notatki", `aria-expanded="true"`, the "Typ pacjenta" section
visible, and the prefilled tooth on screen. A second case stubs a 500 and asserts the form
stays collapsed with the error message shown. Creates no database rows, so no cleanup.

### Success Criteria:

#### Automated Verification:

- Type checking and lint pass: `npm run lint`
- Unit suite green (167 tests): `npm run test`
- Production build succeeds: `npm run build`
- Full E2E suite green, existing specs unedited: `npm run test:e2e`

#### Manual Verification:

- On `/admin/quotes/new`, pasting a real note and clicking "Wypełnij z notatki" leaves the
  filled form open, with no scroll jump and focus still on the button.
- A prefill failure (e.g. API key unset) still shows the error with the form collapsed.

---

## Phase 2: Neutral clinic copy

### Overview

Replace the practice name and town with generic wording everywhere they are tracked.

### Changes Required:

#### 1. Product documentation

**File**: `README.md`, `context/foundation/prd.md`, `context/foundation/shape-notes.md`

**Intent**: Describe the persona and the single-practice scope generically. Keep every
sentence's meaning — including "one practice, one dentist, no multi-tenant" — and change
only the identifying words.

**Contract**: Sections touched: README "The problem"; PRD "Vision & Problem Statement" and
"User & Persona"; shape-notes `decision:` line on tenancy, the source note, the problem
statement, the persona heading, and the multi-tenant non-goal.

#### 2. Data file comment

**File**: `src/lib/pricing/data/pricing.json`

**Intent**: The `$comment` describes the export's provenance; it does not need the practice
name.

**Contract**: `$comment` string only. No pricing key, value, or structure changes — the Zod
seed and its tests read the data, not the comment.

#### 3. Archived plan documents

**File**: `context/archive/2026-06-03-pricelist-seed-foundation/plan.md`, `plan-brief.md`

**Intent**: Same substitution in the two archived documents that name the practice.

**Contract**: Proper noun → generic noun. No other edit to archived content, no frontmatter
or status change.

### Success Criteria:

#### Automated Verification:

- No tracked file matches the practice name or town: `git ls-files -z | xargs -0 grep -il "dentina\|ko.obrz"` prints nothing (grep's exit 1 is the pass)
- Pricelist seed gate still green (F-02 has no test file of its own): `npm run validate:pricing`
- Unit suite still green: `npm run test`
- Build still succeeds: `npm run build`

#### Manual Verification:

- README and PRD still read naturally — no sentence left dangling around a removed name.

---

## Testing Strategy

### Unit Tests:

- None added: the reveal is component state with no pure-function seam worth inventing, and
  Phase 2 touches prose plus one JSON comment.

### Integration Tests:

- `e2e/quote-prefill-reveal.spec.ts` — success reveals, failure does not (network stubbed).

### Manual Testing Steps:

1. `npm run dev`, sign in, open `/admin/quotes/new`.
2. Paste a diagnosis note, click "Wypełnij z notatki" — the form opens with the result.
3. Collapse it with "Ukryj formularz ręcznie", run the prefill again — it reopens.
4. `rg -i "dentina|ko.obrz"` over tracked files — no hits.

## References

- Plan review: `context/changes/note-prefill-reveal-neutral-copy/reviews/plan-review.md`
- Change identity: `context/changes/note-prefill-reveal-neutral-copy/change.md`
- Disclosure behaviour under test: `e2e/quote-form-disclosure.spec.ts`
- Prefill contract: `src/lib/llm/schema.ts:80`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Reveal the form after a successful prefill

#### Automated

- [x] 1.1 Lint and type check pass
- [x] 1.2 Unit suite green
- [x] 1.3 Production build succeeds
- [x] 1.4 E2E suite green with existing specs unedited

#### Manual

- [ ] 1.5 Real prefill leaves the form open, no scroll jump
- [ ] 1.6 Failed prefill leaves the form collapsed with the error shown

`npm run lint` clean; `npx astro check` 0 errors over 134 files; `npm run test` 167/167 in 22
files; `npm run build` complete. `npm run test:e2e` 11/11 — the suite's 9 existing specs
unedited (`git diff --stat` touches only the new `e2e/quote-prefill-reveal.spec.ts`), plus the
two new cases. The warnings list is a `role="group"`, not a region: the spec's first run said
so, and the locator was corrected rather than the assertion dropped. 1.5/1.6 are the same two
behaviours against the live model instead of a stubbed route — left for the human pass.

### Phase 2: Neutral clinic copy

#### Automated

- [ ] 2.1 No tracked file matches the practice name or town
- [ ] 2.2 Pricelist seed gate green (`npm run validate:pricing`)
- [ ] 2.3 Unit suite still green
- [ ] 2.4 Build still succeeds

#### Manual

- [ ] 2.5 README and PRD still read naturally
