<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Tooth chart on the patient page and in the editor

- **Plan**: `context/changes/tooth-chart-visualization/plan.md`
- **Scope**: Phases 1–4 of 4 (full plan)
- **Date**: 2026-09-06
- **Verdict**: NEEDS ATTENTION → resolved in one round (4 fixed, 4 accepted with reason, 1 deferred, 1 recorded)
- **Findings**: 0 critical · 7 warnings · 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | WARNING |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Automated verification

Every command in the plan's Success Criteria, re-run after the fixes below:

| Command                                                   | Result                                        |
| --------------------------------------------------------- | --------------------------------------------- |
| `npm test`                                                | 116 passed / 12 files (113 before the fixes)  |
| `npm run lint`                                            | clean                                         |
| `npx astro check`                                         | 0 errors, 0 warnings, 4 hints                 |
| `npm run depcruise`                                       | no violations (123 modules, 264 dependencies) |
| `npm run test:e2e`                                        | 6 passed                                      |
| `grep -rn "Odontogram\|--dark-blue\|data-read-only" src/` | nothing outside `paths.ts`                    |
| `npm run build`                                           | exit 0 (workerd SSR bundles)                  |

## The SSR `useRef` error is a dev-only Vite artifact, not a defect

Running `astro dev` logs `TypeError: Cannot read properties of null (reading 'useRef')`
and "Invalid hook call" at `ToothChart.tsx:64`. Diagnosed and dismissed:

- Two React module instances in Vite's **dev** SSR graph — `react` is
  `deps_ssr/chunk-EMAOOZFV.js?v=8bb7bdb7`, `react-dom/server` is
  `react-dom_server.js?v=3b1e5094`. `react-dom/server` set the dispatcher on its own
  copy; `ToothChart` read `ReactSharedInternals.H` from the stale one and got `null`.
- It fires only in the window right after `[vite] optimized dependencies changed.
reloading`. In steady state the log is clean and `SignInForm` — four `useState`s on
  the same code path — SSRs fully.
- `npm ls react react-dom` → one `react@19.2.6` / `react-dom@19.2.6`, everything
  deduped; one copy on disk; `ToothChart` imports only `react` and local `@/lib/*`.
- The throw comes from `@astrojs/react`'s `check()`, which renders the component
  inside a `try/catch`, so hydration still emits and the page works.
- **Production is unaffected**: `npm run build` exits 0; the prod build has no
  `deps_ssr` optimizer and Rollup resolves the single React copy.

No code change warranted. `rm -rf node_modules/.vite` silences the noise.

## Findings

### F1 — Tooltip is not dismissible from the keyboard (WCAG 1.4.13)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/components/tooth-chart/ToothChart.tsx:95-99`, `:108-110`
- **Detail**: `onKeyDown` handled only Enter and Space, so the tooltip could not be
  dismissed without moving focus — SC 1.4.13 dismissible. It is also not hoverable
  (`ToothTooltip.tsx:44` is `pointer-events-none`). Separately, `onMouseLeave` on the
  `<svg>` cleared `active` unconditionally, so a keyboard-focused tooth lost its
  tooltip whenever the mouse happened to drift off the drawing.
- **Fix**: Escape → `setActive(null)`; `onMouseLeave` clears only when focus is not
  inside the chart container.
- **Decision**: FIXED
- **Note**: hoverable is not answered. The tooltip carries no interactive content and
  duplicates what the grouped list states in full sentences, which is the documented
  reason it may stay pointer-transparent.

### F2 — The chart's jump target had no accessible name

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/components/admin/ToothRow.tsx:44-52`
- **Detail**: Clicking a planned tooth calls `getElementById(...).focus()` onto a bare
  `<div tabIndex={-1}>` with no role and no name. A screen-reader user pressing Enter
  on a tooth landed somewhere that announced nothing — and "which tooth" is the entire
  content of the jump. The same gap is why the E2E spec had to address the row's three
  selects by `.nth(index)`: their `aria-label`s ("Status", "Rodzaj leczenia",
  "Pilność") are page-global, and the row offered nothing to scope them to.
- **Fix**: `role="group" aria-label={toothName(tooth.number)}` on the same div. Zero
  visual change.
- **Decision**: FIXED — and the spec's `.nth(index)` addressing was removed with it
  (see F10).

### F3 — The patient page's tooth sections were not landmarks

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `ToothGroups.astro:41`, `DeferredSection.astro:33`,
  `ScenariosSection.astro:30`, `PatientQuote.astro:57`
- **Detail**: A `<section>` with no accessible name is not exposed as `role="region"`,
  so a patient navigating this document with a screen reader had no landmark between
  the three tooth lists. It is also why the spec read "which list is this tooth in"
  through `closest("section")?.querySelector("h2")` inside `evaluate` — the only
  structural jump in the file, and one that would break on any markup change.
- **Fix**: `aria-labelledby` pointing at each section's existing `<h2>` (the chart
  section too, for consistency).
- **Decision**: FIXED — the spec now uses `getByRole("region", { name })`.

### F4 — The patient page ships ~70 KB gz of React for a tooltip

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; wide blast radius
- **Dimension**: Safety & Quality
- **Location**: `src/components/patient/PatientQuote.astro:59`
- **Detail**: `client:load` puts React on a page that previously shipped zero JS:
  `client.BpiGNWOd.js` 182 KB raw / **57 KB gz**, plus `ToothChart` 8.5 KB (4.3 gz)
  and `utils` 27 KB (8.6 gz) — ≈ **70 KB gz** total. The SVG itself is fully SSR'd and
  static; the island buys the hover/tap tooltip and nothing else, on a document a
  patient opens once, often on a slow phone.
- **Decision**: ACCEPTED — the plan's Performance Considerations decided this in
  advance: "Measure before optimising", with the named fallback of rendering the base
  drawing server-side and hydrating only the tooltip. **The measurement is the number
  above and this line is its record.** Rewriting the read-only chart without React is a
  separate change, not this PR. `client:visible` was considered and rejected: the chart
  sits above the lists, so on a phone it enters the viewport immediately and the
  directive would defer nothing while adding a second code path.

### F5 — Focus ring on an SVG `<g>` uses CSS `outline`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/components/tooth-chart/ToothChart.tsx:144-147`
- **Detail**: The only focus indicator is `focus-visible:outline-*` on an SVG element.
  WebKit historically does not paint CSS `outline` on SVG, so on the surface whose
  primary audience is mobile Safari the keyboard focus ring may not exist. Plan
  criterion 2.7 was verified, but in Chromium.
- **Fix**: a `stroke`-based indicator (`focus-visible:[stroke-width:3]` or an explicit
  focus-ring path), which also survives print and forced-colors.
- **Decision**: SKIPPED, with reason — the claim is a browser-behaviour assertion that
  has not been confirmed against this markup on this project's Safari, and changing the
  indicator blind would replace a ring that demonstrably works in Chromium with one
  verified nowhere. It belongs behind the manual Safari pass, alongside B13 (visual
  assessment), not in a review round that cannot run that browser. Recorded so the
  next person checking the chart in Safari knows exactly what to look at.

### F6 — `<g role="button">` where the plan said `<button>`, and read-only teeth outside the quote are inert

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/components/tooth-chart/ToothChart.tsx:16-21`, `:129`, `:146`
- **Detail**: Two deviations from the phase-2 contract.
  (a) The plan said each tooth is a `<button>` inside the SVG. It is a `<g>` with
  `role="button"` (or `role="img"`), because an HTML button inside `<svg>` is invalid
  content and needs a `<foreignObject>` that breaks the drawing's coordinate space.
  The a11y intent — focusable, Polish accessible name, Enter/Space activates — is met,
  and the substitution is argued in the file's own header.
  (b) The plan said read-only buttons "remain focusable and hoverable".
  `focusable = interactive || tooth.inQuote` plus `pointer-events-none` means the ~28
  teeth _not_ in the quote are neither on the patient page, so their
  "… — nieobjęty planem" label is unreachable there.
- **Decision**: ACCEPTED as documented deviations, both reasonable — (a) is a contract
  that could not be implemented literally, (b) avoids 32 dead tab stops on a patient
  document. This review file is their record; the plan is not amended, because a
  stamped plan describes what was decided before implementation and this is what
  implementation found.

### F7 — A fourth urgency table outside `marks.ts`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: `src/components/tooth-chart/ChartLegend.tsx:23-27`; `style.ts:29`
- **Detail**: `URGENCY_INK: Record<Urgency, string>` is defined in the legend
  component — the exact divergence `marks.ts` was extracted to prevent in `ui-redesign`
  (`reviews/impl-review.md:145-152`). `marks.ts:8-9` already claims the `-ink` variants
  in its vocabulary but ships no table for them. A smaller leak of the same rule:
  `style.ts:29` returns the literal `"fill-none stroke-border [stroke-width:1]"`,
  though the plan said `style.ts` "defines nothing".
- **Fix**: move `URGENCY_INK` into `marks.ts` beside `URGENCY_MARK` and `URGENCY_FILL`.
- **Decision**: SKIPPED, with reason — the `-ink` strings are hand-written in five
  places this change did not touch (`Banner.astro:20-21`, `ToothRow.tsx:161`,
  `QuoteEditor.tsx:579`, `ParseWarnings.tsx:34`), so moving only the legend's copy
  creates a table that four call sites still bypass — the appearance of consolidation
  without the fact of it. The honest fix is one sweep that extracts `URGENCY_INK` and
  routes all five through it, which is a change to files outside this plan's scope.
  Carried as a follow-up rather than half-done here.

### F8 — `geometry.ts` appears in no phase of the plan

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `src/lib/tooth-chart/geometry.ts` (+ `geometry.test.ts`)
- **Detail**: 133 lines of transform and centre maths named nowhere in the plan. It
  does work the plan explicitly requires and does not otherwise place: the 0.85 milk
  scale about a shape's own centre, and the outward displacement that keeps a milk
  tooth and its permanent successor both visible (`layout.ts:64-71` produces
  `arcOffset`; `geometry.ts:90-106` spends it). Two pieces go beyond the letter of the
  plan: `CHART_VIEWBOX_PADDED` (`:61-66`), because the component renders a padded box
  so a displaced tooth 11 is not clipped, and `SHAPE_CENTERS` (`:24-33`), a constants
  table with a test proving it is computed from the path data rather than copied.
  All of it is our own code, so the vendoring boundary is untouched.
- **Decision**: ACCEPTED as decomposition of phase 1, not new scope. Recorded here so a
  future reader does not mistake an unnamed module for undeclared work.

### F9 — `roadmap.md` still has S-06 as "in progress"

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `context/foundation/roadmap.md:186`
- **Detail**: `plan.md` is stamped through phase 4, `change.md` is `implemented`, and
  the neighbouring S-09 reads `Status: done — …`.
- **Decision**: DEFERRED to the merge. The line is accurate while the branch is open;
  it flips with the archive step, not with this commit.

### F10 — Two places where the spec could silently measure the wrong thing

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `e2e/tooth-chart.spec.ts:248`; `src/lib/tooth-chart/style.test.ts`
- **Detail**: (a) `paintedColour(row, "[aria-hidden='true']", …)` took the **first**
  hidden descendant of a list row. Today that is the urgency dot; the day an icon is
  added ahead of it the test compares a different element's colour and still passes.
  (b) `style.test.ts` covered `toothClasses` across every urgency × status pair but not
  `needsHatch` / `HATCH_OVERLAY_CLASSES` — the mark that carries `out-of-current-plan`
  in greyscale and in print, exactly where `lessons.md` already records one defect.
- **Fix**: (a) require exactly one match and fail with the count otherwise;
  (b) three tests: hatch on `out-of-current-plan` and nothing else, no hatch for a tooth
  outside the quote, and a single 65% on the overlay.
- **Decision**: FIXED — plus the two structural concessions F2 and F3 unlocked:
  `.nth(index)` on the row selects became `getByRole("group", { name: /^16 / })`, and
  the `closest("section")` walk became `getByRole("region", { name })`. The spec now
  contains no positional locator and no DOM-structure traversal; the only CSS left is
  the `querySelectorAll` reading a computed colour off `aria-hidden` decoration that
  has no accessible handle by design.

## Follow-ups carried out of this review

- **F5** — verify the chart's keyboard focus ring in Safari (desktop and iOS) during
  the manual visual pass; if it does not paint, replace the CSS `outline` with a
  stroke-based indicator.
- **F7** — one sweep extracting `URGENCY_INK` into `marks.ts` and routing all five
  current call sites through it.
- **F4** — if the patient page's JS weight ever shows up as a real cost, render the
  base drawing server-side and hydrate only the tooltip (the plan's own fallback).
