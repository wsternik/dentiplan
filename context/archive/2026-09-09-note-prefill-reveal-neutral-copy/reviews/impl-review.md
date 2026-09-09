<!-- IMPL-REVIEW-REPORT -->

# Implementation review — note-prefill-reveal-neutral-copy

One round, both phases, on `feat/note-prefill-reveal-neutral-copy` against `main`. Reviewed by
an agent that did not write the code and read only the branch diff, the plan and
`context/foundation/lessons.md`. Triage below: every finding, and what was done with it.

## Taken

**CRITICAL — the name survived Polish declension.** `context/foundation/roadmap.md:84` said
`pełny cennik Dentiny` and `:253` said `v1 obsługuje wyłącznie Dentinę`. Phase 2's gate grepped
for the nominative, so both passed it and the file never entered the plan's file list. Fixed —
`cennik gabinetu`, `wyłącznie jeden gabinet` — and the gate now greps the **stem** (`dentin`)
with the product's own name and the English dental vocabulary excluded. The plan's Desired End
State said "no tracked file names the practice"; until this it was false, in a repo that goes
public.

**WARNING — the reveal was announced to nobody.** The single live region (`operationStatus`)
said "Wypełnianie formularza z notatki." while parsing and then fell silent, so a screen-reader
user was told neither that the model answered nor that a form had opened around her —
`aria-expanded` is only read on focus, and focus was not there. Added `parseStatus`, set beside
the reveal, so the region ends on "Wypełniono formularz z notatki. Formularz jest otwarty,
liczba zębów: N."

**WARNING — the click destroyed its own focus.** `inert` on the busy wrapper is an ancestor of
the prefill button, so the button blurs on click and focus lands on `<body>`. Harmless while
nothing appeared; with the reveal it means the keyboard path to the fields that just opened
starts at the top of the document. Focus is now restored to the button in an effect keyed on
`parsing` — not in `handlePrefill`'s `finally`, where the ancestor is still `inert` and the
call would be rejected. Manual criterion 1.5 ("focus still on the button") described behaviour
the code did not have; it does now, and the E2E spec asserts it.

**WARNING — the stub's visit label was a state production cannot produce.** `orderVisits`
overwrites every label from a closed dictionary (`src/lib/llm/visits.ts:95`) before the endpoint
answers, so `label: ""` was unreachable. `label` is `string`, so the `PrefillResult` typing the
spec leans on could not catch it. Now `"Leczenie pilne"` — what that stub's teeth would actually
be labelled.

**OBSERVATION — the failure stub quoted copy that exists nowhere in the app.** Replaced with the
endpoint's own 502 message (`src/pages/api/admin/quotes/parse.ts`), so a drift in that string
now fails the spec instead of passing against a fabrication.

**OBSERVATION — two tests in one spec file.** `context/foundation/test-plan.md:170` fixes "one
test per file" and all eight existing specs hold to it. Split into
`e2e/quote-prefill-reveal.spec.ts` and `e2e/quote-prefill-failure.spec.ts`.

**OBSERVATION — the substitution said the same thing twice.** `shape-notes.md:11` became "Tylko
jeden gabinet — 1 gabinet, 1 dentystka"; now "Tylko 1 gabinet, 1 dentystka". `README.md:17` used
"the practice" as a definite reference on first mention; now "a single-practice clinic", the
phrasing the plan itself proposed.

## Not taken

**WARNING — `pricing.json` came back reformatted (386 lines).** `main`'s copy was never
Prettier-clean, and `.husky/pre-commit` runs `lint-staged` over anything staged, so the
one-string `$comment` edit dragged the whole file into the repo's own format. Keeping it: the
alternative is committing a file the repo's formatter rejects, behind `--no-verify`, to make one
diff smaller. The reviewer verified the data is semantically identical (parsed, `$comment`
blanked, key-sorted, diffed — identical), `npm run validate:pricing` passes, and F-02's contract
surface (ids, names, prices, flags, fee schedule) is untouched. Called out in the PR so the
reviewer reads the diff for what it is.

**OBSERVATION — the two archived documents were re-padded by the same hook** (markdown tables,
`*emph*` → `_emph_`). Same cause, same answer. No content changed.

**OBSERVATION — the reveal fires on any 200, including an empty tree.** Reachable: a note the
model cannot place returns warnings and no teeth. Left as is. That case is exactly when she most
needs to see the form — the warnings explaining why it is empty render inside the section that
opens, and a prefill that succeeds while nothing appears is the defect this change exists to
remove, not a state worth reproducing on a technicality.

## Verdict

Two real defects (the surviving name, the silent-and-unfocused reveal) and four contract nits,
all closed. Nothing from "What We're NOT Doing" crept in: the component diff moves no scroll,
adds no trigger on note input, re-collapses nothing, and no existing spec was edited.

## Pipeline review (PR #19, advisory)

APPROVED, three minor findings, one read.

**Taken — the failure branch never asserted the focus restore.** `restoreFocusAfterPrefill` is
set unconditionally, so the effect runs on both branches, and the branch where losing focus
hurts more is the one where nothing appeared. `e2e/quote-prefill-failure.spec.ts` now asserts it
too.

**Not taken — "split the pricing.json reformat and the README wording into their own PR"** (two
of the three findings). The agent reads the diff, not the plan: the prose pass is not scope
creep riding along, it is the second of this change's two stated halves. The `pricing.json`
diff is the pre-commit formatter, already triaged above.
