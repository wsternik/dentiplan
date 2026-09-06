---
date: 2026-09-06T09:51:04Z
researcher: Wojciech Sternik
git_commit: 67bbe34e01437db5142df61b198111bde492f08e
branch: feat/tooth-chart-visualization
repository: dentiplan
topic: "Where a tooth chart hooks into the patient page and the editor, and whether the vendored geometry is correct"
tags: [research, codebase, tooth-chart, odontogram, svg, vendoring, licensing]
status: complete
last_updated: 2026-09-06
last_updated_by: Wojciech Sternik
---

# Research: tooth chart on the patient page and in the editor (S-06)

**Date**: 2026-09-06T09:51:04Z
**Researcher**: Wojciech Sternik
**Git Commit**: 67bbe34e01437db5142df61b198111bde492f08e
**Branch**: feat/tooth-chart-visualization
**Repository**: dentiplan

## Research Question

Where in `PatientQuote.astro`, `ToothGroups.astro`, `QuoteEditor.tsx`, `ToothRow.tsx`
and `types.ts` does the chart attach; what the house conventions require of a new
island and a new pure `src/lib/` module; and — the question this research exists to
settle before anything is built — **whether the geometry we are about to copy places
the FDI quadrants where FDI says they go.**

The "library or own SVG" question is _not_ in scope. It was decided on 6 IX (copy the
geometry as data, write the component here) and this document records the licence
consequences of that decision, not a re-litigation of it.

## Summary

Three findings change what the plan has to say.

1. **The vendored quadrant table is wrong, and it is wrong in both layouts.**
   `react-odontogram` renders FDI quadrant 3 on the viewer's _left_ and quadrant 4 on
   the viewer's _right_ — the two lower quadrants are swapped relative to FDI. The
   suspicion recorded in the session plan is confirmed, and the confirmation is
   visual, not inferential (reproduction below). The library also contradicts
   _itself_: `convertFDIToNotation` maps `3 → LL` and `31 → Universal 24`, which is
   correct FDI, while `quadrants[2]` is labelled `"Lower Right"` and drawn there. The
   cost to us is one line, because the FDI → slot mapping is ours: we copy the four
   transforms as **slots**, not as quadrants, and `layout.ts` maps quadrant 3 to the
   lower-right slot and quadrant 4 to the lower-left one.

2. **`urgencyFromNote` never reaches `content`,** so a chart drawn from saved quote
   data has no provenance signal at all. A model-inferred urgency and a
   dentist-read one are the same byte in `ToothEntry.urgency`. The handoff's demand
   that "the drawing must not suggest this is a fact from the note" therefore cannot
   be met by colouring the tooth differently — there is nothing to colour differently
   _from_. It is met by not making a claim the data does not support: the chart
   colours urgency, the FR-012/FR-015 warnings (dentystka-only) say which of those
   urgencies the model supplied, and the patient chart shows only values the
   dentystka approved. No new field, no new migration.

3. **There is no tooltip primitive, no cost-per-tooth accessor, and no addressable
   tooth row.** Each is small on its own; together they are most of phase 2 and 3's
   real work, and none of them is visible from the session plan's prose.

## Detailed Findings

### A. The quadrant defect (the thing to settle first)

`../react-odontogram` @ `81b48eb`, tag `0.5.6`.

`src/utils.ts` exports two transform tables. `Odontogram.tsx:88-90` picks between them:

```ts
const teethpath = layout === "circle" ? teethPaths : NewTeethPaths;
const quadrants = layout === "circle" ? oldquadrants : newquadrants;
```

and `Odontogram.tsx:403-407` assigns FDI numbers **by array index**:

```tsx
{
  visibleQuadrants.map(({ name, transform, label }, index) => (
    <g key={name} transform={transform}>
      {renderTeeth(`teeth-${index + 1}`)}
    </g>
  ));
}
```

with `renderTeeth` building the id as `` `${prefix}${tooth.name}` `` (`:294`) — so
slot index 2 becomes `teeth-3x` whatever it draws.

The third entry of both tables (`utils.ts` `quadrants[2]` and `oldquadrants[2]`) is:

```ts
{ name: "third", transform: "scale(1, -1) translate(0, -694)", label: "Lower Right" }
```

`scale(1,-1) translate(0,-694)` flips vertically and leaves x alone, so it renders on
the same side as quadrant 1 — the viewer's left, i.e. the patient's **right**. The
library then numbers it `3x`. In FDI, quadrant 3 is the patient's lower **left**.

**Reproduction** (this is the verification the session plan required; re-runnable):

```js
// scratch: renders the raw vendored data with real getBBox() centroids per tooth
const { teethPaths, NewTeethPaths } = await import("../react-odontogram/src/data.ts");
const oldq = [
  "",
  "scale(-1, 1) translate(-409, 0)",
  "scale(1, -1) translate(0, -694)",
  "scale(-1, -1) translate(-409, -694)",
];
// <g transform={oldq[i]}> ... <path data-n={`${i+1}${tooth.name}`}> ...
// then label each path at its getBBox() centre, viewBox "0 0 409 694"
```

Rendered result, unambiguous: **`11–18` upper-left ✓, `21–28` upper-right ✓,
`31–38` lower-LEFT ✗, `41–48` lower-RIGHT ✗.** The square layout
(`NewTeethPaths` + `quadrants`, viewBox `0 0 900 150`) shows the identical swap.

Two further observations from the same render, both relevant to which layout we adopt:

- The **circle layout is anatomically right** apart from the swap: the two arches face
  each other, incisors at the outer top and bottom, molars meeting in the middle. It
  reads as a mouth. Recommended for both surfaces.
- The **square layout leaves a ~48-unit gap at the midline** (quadrant 1 ends at
  x ≈ 423.7, the mirror `x' = 895 - x` restarts it at x ≈ 471.4, in a 900-wide box),
  so `11` and `21` sit visibly apart. Cosmetic, and ours to retune since we own the
  transform — but it is a reason not to reach for the square layout by default.

**What this means for `paths.ts` and `layout.ts`.** Copy from `src/utils.ts` the four
transform strings as an **unnamed, unnumbered slot list** — `SLOT_TRANSFORMS[0..3]`
in draw order (upper-left, upper-right, lower-left, lower-right of the image) — and
copy the library's `label` field **not at all**, since two of the four are wrong and
they are English besides. `layout.ts` owns the mapping and it is explicit:

```
FDI quadrant 1 → slot 0 (upper-left)    FDI quadrant 2 → slot 1 (upper-right)
FDI quadrant 4 → slot 2 (lower-left)    FDI quadrant 3 → slot 3 (lower-right)
```

This mapping deserves a unit test naming the defect, not a comment: the test is the
only thing that will stop someone "tidying" the table back into index order.

### B. Licence — what has to be written, and the wrinkle

- `../react-odontogram` has **no `LICENSE` file**. MIT is declared in two places only:
  `package.json:5` `"license": "MIT"` and `README.md:321-323` — `MIT © biomathcode`.
- Version `0.5.6`, commit `81b48eb` (2026-04-30), author Pratik Sharma
  (`package.json:4`), repo `https://github.com/biomathcode/react-odontogram`.
- MIT requires the notice to travel with the copy, so we supply the canonical MIT text
  ourselves from the standard template and say so plainly in
  `THIRD-PARTY-NOTICES.md` — the upstream declares MIT but ships no text, and
  inventing a "verbatim" quote of a file that does not exist would be the worse error.
  Copyright line: `Copyright (c) biomathcode (Pratik Sharma)`.
- Neither `THIRD-PARTY-NOTICES.md` nor any vendoring paragraph exists yet
  (`context/foundation/tech-stack.md` is 48 lines, two headings: `## Why this stack`
  :22 and `## LLM provider` :26). Both are new files/sections in this change.
- This is a merge gate for phase 1, because the repo is going public (B11).

### C. Domain types — `src/types.ts`

- `:33-34` `ToothStatusSchema = z.enum(["in-plan","uncertain","out-of-current-plan"])`
- `:41-42` `UrgencySchema = z.enum(["urgent","moderate","mild"])`
- `:45` `type Dentition = "milk" | "permanent"`
- `:54-56` `dentitionForTooth(n)` → `milk` for 51–85, else `permanent`
- `:108-117` `ToothEntrySchema`: `number`, `treatmentType` (nullable), `urgency`
  (**nullable**), `status` (default `in-plan`), `note`, `pricelistItems[]`,
  `visitNumber`
- `:162-167` `QuoteContentSchema`: `teeth[]`, `visits[]`, `generalItems[]`, `totals?`

Two consequences the plan must carry:

- **`urgency` is nullable and `URGENCY_MARK` has no key for `null`**
  (`src/lib/quote/marks.ts:22-29`, whose comment says a missing urgency deliberately
  gets no mark). A list can omit a dot; a chart cannot omit a tooth. Every drawn tooth
  needs a colour, so the null case draws `--urgency-unknown`
  (`src/styles/global.css:50-51`), which exists precisely for this.
- **There is no per-tooth cost.** Cost derives from `pricelistItems[]`
  (`PricelistItemRefSchema` `:88-93`, `PriceValueSchema` `:75-80` — a discriminated
  union `fixed | range | modifier | from`). `sumItems()` in `src/lib/quote/cost.ts:69`
  is **not exported**; only `computeQuoteTotals` (`:100`) is. The tooltip's "cost"
  therefore needs either a new export from `cost.ts` or a per-tooth sum in
  `model.ts`. Prefer exporting the existing `sumItems` over writing a second summer —
  two cost paths that can disagree is exactly the class of defect `marks.ts` was
  extracted to prevent.

Naming is already solved: `src/lib/quote/tooth-name.ts:76` `toothName(n)` returns
`"74 — pierwszy trzonowiec mleczny lewy dolny"`, and `:62` `isValidToothNumber(n)`.
Labels for the tooltip and legend: `src/lib/quote/labels.ts` — `TREATMENT_LABELS:6`,
`URGENCY_LABELS:14` (`pilne/umiarkowane/łagodne`), `STATUS_LABELS:20`
(`w planie/niepewne/poza bieżącym planem`), `DENTITION_LABELS:26`.

### D. Patient page

- Route `src/pages/p/[token].astro` — SSR (`prerender = false` `:25`), RPC
  `get_quote_by_token` `:47`, renders `<PatientQuote content=… />` `:72`.
- `src/components/patient/PatientQuote.astro:25-27` buckets teeth into
  `inPlan` / `deferred` / `uncertain`; the section stack is `:45-50`:

```astro
<div class="mt-10 space-y-12">
  <VariantComparison totals={content.totals} visits={content.visits} />
  {inPlan.length > 0 && <ToothGroups teeth={inPlan} />}
  {deferred.length > 0 && <DeferredSection teeth={deferred} />}
  <ScenariosSection uncertain={uncertain} totals={content.totals} />
</div>
```

**Insertion point: `PatientQuote.astro:47`**, above `<ToothGroups>`. Note the chart
takes `content.teeth` _whole_, not `inPlan` — status is one of the things it draws, so
bucketing before the chart would discard its subject.

`ToothGroups.astro:9-13` already says in its own header that S-06 complements it and
that it is not a faithful 2×2 chart; `:26-31` carries the quadrant labels in Polish
(`Górne prawe`, `Górne lewe`, `Dolne lewe`, `Dolne prawe`) — reuse these rather than
translating the library's.

**Print** (`src/styles/global.css`, `@media print` at `:191`): `--background:#fff`,
`--foreground:#000`, `--border:#999` `:192-199`; `.no-print` hidden `:208`;
`.quadrant, li { break-inside: avoid }` `:239-241` — the chart wrapper wants the same;
`#patient-print-footer` `:253` is S-07's slot. SVG `fill` prints; a CSS
`background-image` does not (the `DeferredSection.astro:1-20` lesson). Since the chart
draws with SVG `fill`/`stroke`, the "background carries meaning" trap is avoided by
construction — but the _legend_ must not fall into it, and the hatch for
`out-of-current-plan` must be an SVG `<pattern>`, not a CSS gradient.

### E. Editor

`src/components/admin/QuoteEditor.tsx` (default export, `client:load` from
`admin/quotes/new.astro:20` and `admin/quotes/[id].astro:58-68`).

- State is **three plain `useState`s in the island**, no reducer, no hook:
  `:67-69` `teeth` (sorted ascending by number on every write), `:70` `visits`,
  `:71` `generalItems`; `:99-102` a `treeRef` mirror for async prefill; `:117`
  `totals = useMemo(computeQuoteTotals, …)`.
- **`addTeeth()` takes no arguments today.** `:120-151` it reads the text input,
  splits on `/[\s,]+/`, validates with `isValidToothNumber` `:128`, dedupes `:123,132`,
  pushes the default entry `:137-145`, sorts `:148`, sets `toothWarnings` `:149`.
  Callers `:494` (Enter) and `:498` (button). Getting `addTeeth(numbers: number[])`
  means lifting the token→number step out of `:121-126`; the Polish warning literals
  at `:129,133` belong to the _parsing_ half and stay there.
- Mutators are keyed by tooth `number`, not index: `patchTooth` `:153`,
  `removeTooth` `:156`, `addToothItem` `:159`, `removeToothItem` `:164`. Good — the
  chart can address teeth the same way and needs no index bookkeeping.
- **Rows are not addressable.** `:516-536` `teeth.map(t => <ToothRow key={t.number} …>)`;
  `ToothRow.tsx:39` is `<div className={cn("rounded-md border p-3", STATUS_OUTLINE[…])}>`
  — no `id`, no `ref`, no `data-*`. "Click a tooth → jump to its row" needs one added:
  `id={`tooth-${tooth.number}`}` + `tabIndex={-1}` is the minimum, and the ascending-sort
  invariant (`QuoteEditor.tsx:65-66`) makes `number` a stable anchor.
- `readOnly` propagates through `admin/types.ts:7-31` (`:28`) — an approved quote is
  frozen (FR-053), so the editor chart must be inert in that state. Note this is a
  _third_ mode, distinct from the patient's: inert-but-hoverable.
- Load-bearing accessible names not to break: `aria-label={`Usuń ząb ${n}`}`
  `ToothRow.tsx:53`, and the tooth input placeholder `"Numery FDI, np. 17,16,34"`
  `QuoteEditor.tsx:486`, which `seed.spec.ts` and `patient-link-content.spec.ts`
  locate by (comment at `:482-484`).

### F. Conventions a new island and a new lib module must satisfy

- **Islands**: only `client:load` is used, always written as the final attribute;
  imported via `@/` without extension. The patient page currently has **zero islands**
  (`src/pages/p/[token].astro`, `src/components/patient/*.astro`) — the chart is the
  first, which makes `e2e/support/app.ts:19-21` `waitForIslands()` newly relevant to
  the patient specs.
- **Folders**: `src/components/{admin,auth,patient,ui}/`. `.dependency-cruiser.cjs:267`
  `no-cross-component-family-imports` (warn) allows a family to import only itself and
  `ui/`. A chart used by _both_ families therefore belongs in `ui/`-adjacent shared
  space or is deliberately placed and the rule consciously answered — the session plan
  says `src/components/tooth-chart/`, which is a **new family** and will trip this rule
  unless the rule is extended. Decide it in the plan, do not discover it at lint time.
- Hard errors (`:238`, `:249`): a component may not import `@/lib/supabase.ts`,
  `@supabase/*`, or `astro:env/server`. `:220,229`: `src/lib/**` may not import
  `src/components/**` or `src/pages/**`. `npm run depcruise`.
- **Props**: local `interface Props` above the component, each field JSDoc'd,
  destructured in the signature; `type` only for `import type`. Named exports for
  leaves, default export for island roots. Every component file opens with a comment
  naming its story/FR.
- **Tests**: co-located `*.test.ts`; `vitest.config.ts` is `environment: "node"` and
  `include: ["src/**/*.test.ts"]` — **`.test.tsx` is not matched and no component test
  exists in the repo.** The pure layer under `src/lib/tooth-chart/` is testable as-is;
  testing the component would mean changing the vitest include and adding jsdom, which
  is a scope decision for the plan, not a detail. Style: explicit
  `import { describe, expect, it } from "vitest"`, full-sentence `it(...)` names, a
  leading comment saying why the test exists, local factory fixtures.
- **Barrel**: `src/lib/pricing/index.ts:1-2` is the precedent — public surface only,
  values then a separate `export type {…}` block. `quote/` and `llm/` have none.
- **No tooltip primitive exists.** `src/components/ui/` holds exactly `badge`,
  `button`, `input`, `label`, `textarea`. `radix-ui` ^1.4.3 is already a dependency
  (`ui/badge.tsx:3` imports `{ Slot } from "radix-ui"`), so
  `npx shadcn@latest add tooltip` adds no package — but note two standing comments
  declining Radix primitives on purpose (`admin/controls.tsx:1-3`,
  `admin/DeleteQuoteButton.tsx:6-7`), and note that a Radix tooltip is
  hover/focus-only by default while this one must also answer a **tap**. Writing the
  tooltip (as the session plan says) is the smaller commitment.
- **E2E**: `playwright.config.ts` — `testDir: "./e2e"`, `fullyParallel`, `retries: 0`,
  `webServer: npm run dev`, `storageState` from `auth.setup.ts`. No seeding helper and
  no custom fixture: specs create their own rows through the UI and tag them with
  `` `e2e-…-${Date.now()}@example.test` `` (`seed.spec.ts:24`). Test names bind to a
  risk id from `context/foundation/test-plan.md`.

### G. Tokens and marks — already waiting

`src/styles/global.css:36-51`, whose own comment at `:41` says "The tooth chart (S-06)
draws with exactly these":

| token                         | value                                              |
| ----------------------------- | -------------------------------------------------- |
| `--urgency-urgent` / `-ink`   | `oklch(0.545 0.168 27)` / `oklch(0.455 0.155 27)`  |
| `--urgency-moderate` / `-ink` | `oklch(0.735 0.135 68)` / `oklch(0.495 0.105 62)`  |
| `--urgency-mild` / `-ink`     | `oklch(0.655 0.085 142)` / `oklch(0.455 0.07 142)` |
| `--urgency-unknown` / `-ink`  | `oklch(0.8 0.01 205)` / `oklch(0.505 0.028 205)`   |

`@theme inline` `:140-147` aliases them to `--color-urgency-*`, so `fill-urgency-urgent`
and `stroke-urgency-*` resolve in Tailwind.

`src/lib/quote/marks.ts` — `URGENCY_MARK:25-29` and `STATUS_OUTLINE:44-48`. **Neither
is usable on an SVG `<path>` as-is**: the values are `bg-*` and `border-*` classes.
The file's own comment `:14-15` explains the constraint that forces this — Tailwind
scans source statically, so the chart needs its _own_ static lookup table of
`fill-*`/`stroke-*` classes. That is a third table, which is precisely what
`marks.ts` was extracted (ui-redesign F9) to prevent. The honest resolution is to put
the chart's table **in `marks.ts` beside the other two**, so all three stay visibly in
sync, rather than in `tooth-chart/style.ts` where drift is invisible.

The design brief settled the status vocabulary and it survives greyscale by
construction (`context/archive/2026-09-05-ui-redesign/design-brief.md:98-110`):
`in-plan` solid fill + solid outline; `uncertain` **dashed** outline, unfilled;
`out-of-current-plan` 65% opacity + hairline diagonal hatch. The chart inherits this
rather than inventing marks — and inherits with it the "one dimming mechanism per
subtree" rule (`lessons.md`), which for an SVG means the 65% goes on the tooth group
_or_ on its label, never both.

`design-brief.md:191-213` already reserves the slot: the quadrant grid was laid out
2×2 "in true chart orientation … so S-06 replaces a rectangle with a drawing instead
of rebuilding a section."

### H. Provenance — why no new field is needed

`context/archive/2026-09-06-visit-planning-prefill/plan.md:147` — "`urgencyFromNote`
must not reach `content`. It is a field of the wire shape". `:245` defines inferred
urgency as `urgency !== null && urgencyFromNote === false`, and FR-015 (`prd.md:112`)
requires every inferred value to be named **in the FR-012 warnings, dentystka-only**.

So: the saved quote carries no provenance, the patient must not be told about
inference at all, and the dentystka already learns about it in a channel that exists.
A chart that colours `content.teeth[].urgency` is therefore _not_ claiming the note
said so — it is drawing an approved value, which is what FR-013's manual approval
makes it. The plan should state this explicitly rather than leave a reviewer to
rediscover it, and it should state the corollary: **do not add a "proposed by the
model" marker to the chart**, which `plan-brief.md:61-70` already ruled out of scope
for `ToothRow` for the same reason.

## Code References

- `src/types.ts:33-56, 88-93, 108-124, 162-167` — status/urgency/dentition, tooth entry, content root
- `src/components/patient/PatientQuote.astro:45-50` — section stack; chart goes at `:47`
- `src/components/patient/ToothGroups.astro:9-13, 26-31, 57` — the a11y/print layer it complements
- `src/components/admin/QuoteEditor.tsx:67-71, 120-151, 153-164, 486, 516-536` — state, `addTeeth`, mutators, rows
- `src/components/admin/ToothRow.tsx:39, 53` — row root (needs an anchor), remove-button label
- `src/lib/quote/marks.ts:25-29, 44-48` — `URGENCY_MARK`, `STATUS_OUTLINE` (class strings, not SVG-ready)
- `src/lib/quote/tooth-name.ts:62, 76` — `isValidToothNumber`, `toothName`
- `src/lib/quote/labels.ts:6-29` — Polish labels for tooltip and legend
- `src/lib/quote/cost.ts:69, 100` — unexported `sumItems`, exported `computeQuoteTotals`
- `src/styles/global.css:36-51, 140-147, 191-253` — clinical tokens, Tailwind aliases, print block
- `.dependency-cruiser.cjs:220, 229, 238, 249, 267` — the layer rules a new folder meets
- `../react-odontogram/src/utils.ts` `quadrants` / `oldquadrants` — the defective tables
- `../react-odontogram/src/data.ts:1, 99` — `teethPaths` (circle), `NewTeethPaths` (square)
- `../react-odontogram/src/Odontogram.tsx:34-60, 88-90, 294, 403-407` — `getViewBox`, slot→number assignment

## Architecture Insights

- **The repo has been preparing for this change for two slices.** `marks.ts` exists
  because ui-redesign refused to let S-06 write a third copy; `--urgency-unknown` was
  defined for teeth this chart must draw and nothing else uses it; the quadrant grid
  was laid out 2×2 so a drawing could replace a rectangle. The plan's job is mostly to
  _land in the slots already cut_, and any step that invents a parallel structure
  (a second cost sum, a second urgency table, a second set of quadrant labels) is
  going against the grain of work already done.
- **The vendored data is data, and the meaning stays ours.** The one real defect in
  the library is in the layer that assigns _meaning_ to geometry — which is exactly
  the layer the 6 IX decision kept in-house. Copying the transforms as anonymous slots
  and owning the FDI mapping turns a fork-or-patch problem into a lookup table with a
  test.
- **Three interaction modes, not two.** Patient (inert, hoverable, tappable,
  keyboard-reachable), editor-editable (click adds or jumps), and editor-readOnly
  (approved quote, FR-053 — inert but still hoverable). The session plan names two;
  the third falls out of `readOnly` already threading through `admin/types.ts:28`.

## Historical Context (from prior changes)

- `context/archive/2026-09-05-ui-redesign/design-brief.md:49-53, 80-117, 191-213` —
  colour means something clinical; status never carried by hue; the chart's slot.
- `context/archive/2026-09-05-ui-redesign/reviews/impl-review.md:145-152` — F9, the
  extraction of `URGENCY_MARK` done specifically so S-06 would find it.
- `context/archive/2026-09-06-visit-planning-prefill/plan.md:147, 245, 521` and
  `plan-brief.md:61-70, 105-107` — inferred urgency lives in warnings, not in content.
- `context/foundation/lessons.md` — background cannot carry meaning on paper; one
  dimming mechanism per subtree; a media-dependent behaviour is verified at the
  medium's _dimensions_. All three bind this change.

## PRD / roadmap anchors (for the documentation phase)

- Highest FR in use is **FR-072** (`prd.md:172`); numbering is banded per section and
  the patient-view band `### Patient view (public, token-only)` (`:155`) has FR-067+
  free. FR-074–076 as named in the session plan sit outside that band — worth a
  deliberate decision in the plan: follow the band (FR-064–066) or follow the session
  plan's numbers and note why.
- FR-061 `:158` currently reads "(v1 substitute for graphical tooth arch
  visualization.)" — that parenthetical is what stops being true.
- `## Non-Goals → ### Odroczone na v2` `:255`; the line to remove is `:257`
  "Graficzna wizualizacja łuków zębowych z hover-sync". `:258` (drag-and-drop) stays.
- Open Question #4 `:274` (mixed dentition signalling) is the one this change closes.
  #8 `:278` is struck through in place — the precedent for how to mark it resolved.
- `roadmap.md` has **no `### S-06` heading** (slices run S-01…S-05, S-09 at `:95-164`);
  S-06 is a dangling id referenced from `:57`. `## Parked:213` is the entry to move,
  with the "unparked" note. Entry format at `:125-135`.
- `tech-stack.md` gains a vendoring section; `THIRD-PARTY-NOTICES.md` is new at root.

## Open Questions

1. **Which layout — circle or square?** Recommendation: circle. It reads as a mouth,
   it has no midline gap, and it is the one a patient recognises. The square layout's
   only advantage is vertical compactness on a phone, which is worth measuring before
   it is assumed.
2. **Where does the component live?** `src/components/tooth-chart/` is a new family and
   `no-cross-component-family-imports` (warn) will fire when `admin/` and `patient/`
   both import it. Either extend the rule's allowlist or place the chart in a shared
   location. To be decided in the plan, not at lint time.
3. **Does the chart get a component test?** It would be the repo's first — vitest is
   `environment: "node"` with `include: ["src/**/*.test.ts"]`. The pure layer needs no
   change; the component would need jsdom and a config edit. Defensible either way, but
   E2E already covers the integrated behaviour (risk #8), which argues for keeping the
   unit line at `src/lib/tooth-chart/`.
4. **FR numbering** — band (FR-064–066) versus the session plan's FR-074–076. See above.
5. **Milk teeth 51–85 geometry** is an approximation by construction (quadrants of five,
   incisor/canine shapes reused, molar shapes scaled down). It must be _named_ as an
   approximation in this document's successor and in the UI's own terms — a child's
   chart that silently pretends to anatomical fidelity is a worse lie than one that
   says it is schematic.
