# UI redesign implementation plan

## Overview

Give DentiPlan a visual identity of its own, executing `design-brief.md` across
every page. Tokens, typography, layout and component styling change; behaviour,
routes, payloads and DOM semantics do not.

The patient page is the point of the exercise. Everything else exists so the
dentist can produce it.

## Current State Analysis

The app is wearing two costumes at once, neither of them chosen.

- **shadcn's default grayscale.** `src/styles/global.css` is the untouched
  "new-york" token set: every colour is `oklch(L 0 0)` — pure neutral, zero
  chroma — with `--radius: 0.625rem`. The domain surfaces (patient page, admin
  list, editor) are built correctly on those tokens, so they are grey.
- **The Astro starter's cosmic theme**, still live on the pages nobody rewrote:
  `bg-cosmic` (a `#0a0e1a` gradient utility in `global.css`), `Welcome.astro`,
  `LibBadge.astro`, `Topbar.astro`, and `auth/signin.astro` with its
  `from-blue-200 to-purple-200` gradient-clipped heading. `index.astro` renders
  `Welcome` and nothing else, so **the front door of the product is the starter's
  demo page**.
- **No typography decision at all.** No `@font-face`, no `font-family` — every
  page renders in the browser's default UI stack.

Three structural observations that shape the phases:

1. `Topbar.astro`'s only consumer is `Welcome.astro` (`grep -rn Topbar src/`), so
   deleting the starter would delete the panel chrome the brief calls for. Instead
   the Topbar gets rebuilt and adopted by the three admin pages, which currently
   each repeat their own `Zalogowano: {user.email}` line
   (`admin/index.astro:63`, `admin/quotes/[id].astro:56`, `new.astro:17`).
2. `/dashboard` is dead: `dashboard.astro` is starter output, and the only links
   to it are `middleware.ts:4`'s `PROTECTED_ROUTES` and the old Topbar.
3. `QuoteEditor.tsx:428` hand-rolls a bare `<input>` with copied shadcn classes
   instead of using `Input` — so a token change reaches every field except that
   one. Retheming is the moment that stops being invisible.

### Key Discoveries

- **`Layout.astro:16` filters banners by session** — `Astro.locals.user ?
missingConfigs : publicMissingConfigs`. The layout is shared with `/p/<token>`,
  so losing this line puts an admin configuration banner above an anonymous
  patient's estimate, against FR-060. Guarded by `src/lib/config-status.test.ts`.
- **The patient error page is asserted on served bytes.**
  `e2e/patient-link-probe.spec.ts:56-58` requires the response body to contain
  neither `patient_email`, nor `quotes`, nor `draft` as substrings — and inlined
  CSS is part of that body. `quotes` is a real CSS property.
- **`patient-link-content.spec.ts:52` reads `getByRole("textbox")` unqualified**
  on the approval confirmation, so that view must keep exactly one textbox.
- **`seed.spec.ts:31` clicks `getByRole("link", { name: "Nowy kosztorys" })` on
  `/admin`**, which is strict-mode: a Topbar link with that name would make the
  locator ambiguous and fail the suite.
- Fontsource ships per-axis entrypoints. `@fontsource-variable/literata/standard.css`
  carries both `opsz` and `wght` (7 `@font-face` rules, `unicode-range`-split, family
  `Literata Variable`); `@fontsource-variable/archivo/wght.css` carries `wght`
  (family `Archivo Variable`). Both include `latin-ext`, which is what makes the
  Polish diacritics render.

### The frozen contract

Every accessible name below is located by `e2e/`. None of them may change — not
the text, not the role, not the label association. This is the list the
implementer checks a phase against before committing it.

| Where        | Locator                                                                                                                                                                                                                                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sign-in      | textbox `Email`, textbox `Password`, button `Sign in`                                                                                                                                                                                                                                                                                                |
| admin list   | heading `Kosztorysy`, link `Nowy kosztorys`, `getByRole("row")` (stays a real table), text `Szkic`, button `Usuń`, button `Na pewno?`                                                                                                                                                                                                                |
| editor       | label `…Tylko do Twojej referencji…`, label `…Pole robocze…`, textbox placeholder `Numery FDI, np. 17,16,34`, button `Dodaj` (exact), combobox `Dodaj pozycję z cennika…`, combobox `Dodaj pozycję ogólną…`, button `Zapisz szkic`, button `Zatwierdź`, text `Zapisano <time>`, text `16 — pierwszy trzonowiec prawy górny`, text `Lakierowanie · …` |
| confirmation | heading `Kosztorys zatwierdzony`, exactly one textbox                                                                                                                                                                                                                                                                                                |
| patient page | headings `Twój kosztorys leczenia`, `Leczenie w kilku wizytach`, `Leczenie w znieczuleniu (jedna sesja)`; `role="note"` named `Zastrzeżenie` containing `To jest kosztorys szacunkowy`                                                                                                                                                               |
| error page   | heading `Link nieaktywny lub nieprawidłowy`                                                                                                                                                                                                                                                                                                          |

## Desired End State

Every page in the application is set in Literata and Archivo on the enamel/ink
palette from the brief. The patient page opens with the two treatment variants
side by side, drawn as shade tabs with the recommended one marked by weight and
by words. The panel and editor share one chrome. No starter page, no cosmic
gradient, and no purple survives.

Verified by: `npm run test:e2e` green **with `git diff main...HEAD -- e2e/
playwright.config.ts` empty**, `npm test` green, `npm run lint` exit 0,
`astro check` 0 errors, `npm run build` complete, and screenshots of all seven
surfaces at 1280px and 375px.

## What We're NOT Doing

- **Dark mode.** The `.dark` block stays and keeps compiling; it is not designed,
  reviewed, or screenshotted.
- **A WCAG audit.** Text contrast is checked against the brief's tokens; formal
  conformance stays a PRD non-goal.
- **Copy changes**, beyond the two typographic ones in the brief (§3) and what a
  new layout forces. The sign-in form keeps its English `Email` / `Password` /
  `Sign in` because those are test contracts.
- **New behaviour.** No new features, no changed endpoints, no changed payloads.
- **New dependencies** beyond the two font packages. No animation library.
- **Touching `e2e/`** — with one exception, phase 1, below.
- **The tooth chart.** S-06 draws it; this change only decides the tokens it will
  draw with and leaves the quadrant grid shaped like the slot it goes in.

## Implementation Approach

Bottom-up: tokens and chrome first, then the pages that consume them, cheapest
page first, hero page last while there is most attention left. Each phase ends
with `npm run test:e2e` green — the suite is the regression gate for the whole
change, and running it per-phase is what makes a red result mean "this phase",
not "somewhere in the redesign".

Phase order also front-loads the risk: if phase 1's tokens are wrong, every later
phase is wrong, and it is the phase with the fewest lines to undo.

## Critical Implementation Details

**The E2E suite is flaky on a cold `astro dev` and phase 1 makes that worse.**
`e2e/auth.setup.ts` is the only spec that does not call `waitForIslands()`, so on
an unwarmed server it fills the e-mail field before the island hydrates, React
resets it, and sign-in fails on "Email is required" (handoff from S-02). Adding
two bundled webfonts slows first paint further. Phase 1 therefore adds
`waitForIslands(page)` to `auth.setup.ts` before the first `fill`. This is the one
sanctioned edit under `e2e/`: it waits for application state, which is the
suite's own rule, and changes no assertion and no locator. The
`git diff -- e2e/` check for the DoD is run against `e2e/*.spec.ts` and
`playwright.config.ts`; the setup file's one-line wait is recorded here as a
deliberate exception rather than smuggled in.

---

## Phase 1: Tokens, type, and chrome

### Overview

The palette, the two typefaces, the shared layout, and the panel chrome. After
this phase every page has already changed colour and typeface — the later phases
are about structure.

### Changes Required

#### 1. Font packages

**File**: `package.json`

**Intent**: Bundle the two families from npm so no page depends on a font CDN.

**Contract**: `@fontsource-variable/literata@^5.3.0` and
`@fontsource-variable/archivo@^5.3.0` in `dependencies` (not dev — they ship in
the build).

#### 2. Tokens

**File**: `src/styles/global.css`

**Intent**: Replace shadcn's neutral defaults with the brief's enamel/ink palette,
add the clinical tokens S-06 will draw with, register the two font families, and
delete the starter's gradient utility.

**Contract**: `:root` gets the six base values, `--radius: 0.25rem`, and the
clinical tokens as `--urgency-{urgent,moderate,mild,unknown}` plus a matching
`--urgency-*-ink` for each. `@theme inline` gains `--color-urgency-*` (so Tailwind
emits `text-urgency-urgent-ink`, `bg-urgency-mild` etc.) and
`--font-serif` / `--font-sans` bound to `"Literata Variable"` and
`"Archivo Variable"` with real fallback stacks. `@utility bg-cosmic` is deleted.
The `.dark` block keeps every token name defined — including the new ones — so
the variant still compiles; its values are not designed.

Two hard constraints on this file: **no `quotes:` property anywhere** (it is a
real CSS property and would fail `patient-link-probe.spec.ts` on the served
bytes), and no custom-property name containing `quotes` or `draft`.

#### 3. Layout

**File**: `src/layouts/Layout.astro`

**Intent**: Make the document shell carry the identity — the fonts, the default
title, Polish as the default language, and the base typographic setting.

**Contract**: Frontmatter imports
`@fontsource-variable/literata/standard.css` and
`@fontsource-variable/archivo/wght.css` next to the existing `global.css` import.
Default props become `title = "DentiPlan"` and `lang = "pl"` (every page that
matters is Polish; `p/[token].astro` already passes `pl` explicitly and can keep
doing so harmlessly). `<body>` gets the base font, `font-optical-sizing: auto`,
and the enamel background.

**The banner filter at line 16 is preserved verbatim.** Restyle `Banner.astro`,
do not touch which banners this layout selects.

#### 4. Banner

**File**: `src/components/Banner.astro`

**Intent**: Move the banner off its hardcoded hex palette onto tokens, so a
configuration warning looks like part of the product.

**Contract**: Keep the `role` mapping (`error` → `alert`, else `status`) and the
three variants. Colours come from tokens; the error variant uses the urgency-red
ink value.

#### 5. Topbar

**File**: `src/components/Topbar.astro`

**Intent**: Rebuild as the panel's chrome and adopt it in the three admin pages,
replacing the `Zalogowano:` line each of them repeats.

**Contract**: Renders the product name linking to `/admin`, the signed-in
address, and the sign-out form (`POST /api/auth/signout`, unchanged). **It must
not contain a link named `Nowy kosztorys`** — `seed.spec.ts` clicks that name on
`/admin` under strict mode — and **must not contain any textbox**, which would
break the unqualified `getByRole("textbox")` on the approval confirmation. The
signed-out branch and the `/dashboard` link go.

#### 6. Component primitives

**Files**: `src/components/ui/{button,badge,input,textarea,label}.tsx`,
`src/components/admin/controls.tsx`

**Intent**: Let the retheme reach every control, and remove the shadow-based
depth the brief replaces with rules.

**Contract**: Variants keep their names and their APIs — `variant="outline"` and
`size="lg"` are used across the editor and must keep meaning what they mean.
`shadow-xs` comes off surfaces in favour of borders. `Badge` keeps
`rounded-full` (the brief's deliberate exception). `Section` in `controls.tsx`
becomes a ruled block rather than a shadowed card.

#### 7. The E2E cold-start wait

**File**: `e2e/auth.setup.ts`

**Intent**: Stop the suite failing on hydration timing that this phase makes
slower. See _Critical Implementation Details_.

**Contract**: `await waitForIslands(page)` after `page.goto("/auth/signin")` and
before the first `fill`, importing from `./support/app` as the other specs do. No
assertion, locator, or expectation changes.

### Success Criteria

#### Automated Verification

- `npm run lint` exits 0
- `npx astro check` reports 0 errors
- `npm test` passes (61 tests, `config-status.test.ts` included)
- `npm run build` completes
- `npm run test:e2e` passes 4/4
- `grep -c "quotes:" src/styles/global.css` returns 0

#### Manual Verification

- Every page renders in Literata/Archivo, with Polish diacritics correct (`ą ć ę ł ń ó ś ź ż`)
- No purple, no cosmic gradient, and no `oklch(L 0 0)` neutral remains in `global.css`
- A configuration banner still appears for a signed-in dentist and still does not appear on `/p/<token>`

---

## Phase 2: Landing and auth

### Overview

The two public doors. Cheapest pages, and the ones carrying the most starter
residue.

### Changes Required

#### 1. Landing

**File**: `src/pages/index.astro`

**Intent**: Replace the starter demo with a single screen that says what
DentiPlan is and lets the dentist in — with the artifact itself as the hero,
because what the practice buys is what the patient receives.

**Contract**: One screen, no scroll at 1280×800. A miniature of the two variant
tabs rendered in real markup with obviously-invented numbers, one paragraph of
what the product does, and the sign-in link. Anonymous route: it must render
nothing derived from a session and nothing resembling real patient data.
`Welcome.astro` is no longer imported.

#### 2. Auth pages

**Files**: `src/pages/auth/{signin,signup,confirm-email}.astro`

**Intent**: Put the sign-in card on the product's paper instead of the starter's
cosmic gradient.

**Contract**: `bg-cosmic`, the `backdrop-blur` glass card, and the
gradient-clipped heading go. **The form's copy does not change** — `Email`,
`Password`, `Sign in` are accessible names `auth.setup.ts` locates by.

#### 3. Auth form components

**Files**: `src/components/auth/{FormField,PasswordToggle,SubmitButton,ServerError}.tsx`

**Intent**: Move the fields off white-on-glass styling onto the tokens.

**Contract**: `FormField` keeps `label`/`id` association intact — the label text
is the accessible name of the textbox. The lucide icons stay (already a
dependency).

### Success Criteria

#### Automated Verification

- `npm run lint` exits 0, `npx astro check` 0 errors
- `npm run test:e2e` passes 4/4 — this is what proves the sign-in form's contract survived
- `npm run build` completes

#### Manual Verification

- `/` fits one screen at 1280×800 and reads sensibly at 375px
- `/auth/signin` shows no glass, no gradient, and a visible focus ring on both fields
- The sign-up and confirm-email pages match the sign-in page

---

## Phase 3: Panel and editor

### Overview

The tool. Longest phase, most components, no behaviour changes.

### Changes Required

#### 1. Admin list

**File**: `src/pages/admin/index.astro`

**Intent**: Make the list read as a register — dense, scannable, status obvious
at a glance — on the shared chrome.

**Contract**: **Stays a real `<table>`** (`getByRole("row")` is the test's
handle). Adopts `Topbar` and drops its own `Zalogowano:` line. The identifier
column keeps its monospace (the brief's one earned exception). The `Szkic` /
`Zatwierdzony` badge keeps both texts. The empty state stays an invitation to
act.

#### 2. Editor pages

**Files**: `src/pages/admin/quotes/new.astro`, `src/pages/admin/quotes/[id].astro`

**Intent**: Adopt the chrome; restyle the not-found branch.

**Contract**: `Topbar` replaces the repeated `Zalogowano:` line in both. The
island props are untouched.

#### 3. The editor

**File**: `src/components/admin/QuoteEditor.tsx`

**Intent**: Restyle the longest screen in the app and stop its primary actions
scrolling away.

**Contract**: `Zatwierdź` and `Zapisz szkic` move into a bottom-anchored action
bar — **same buttons, same names, same order, same disabled logic**, only
position changes; `Zapisano <time>`, `approveReason`, `submitError` and
`saveError` travel with them. The hand-rolled `<input>` for tooth numbers becomes
`Input`, **keeping `placeholder="Numery FDI, np. 17,16,34"` exactly** — it is the
field's accessible name. Every other label, button text, and section title is
unchanged. No state, no handler, and no fetch is touched.

#### 4. Editor sub-components

**Files**: `src/components/admin/{ToothRow,VisitList,GeneralItems,TotalsPreview,ParseWarnings,ApprovalConfirmation,CopyLink,DeleteQuoteButton,controls}.tsx`

**Intent**: Carry the tokens into the dense parts of the form.

**Contract**: `ParseWarnings` moves to ochre with a hairline left rule and keeps
its `role="group"` and `aria-label`. `ApprovalConfirmation` keeps **exactly one
textbox** and its heading text. `DeleteQuoteButton` keeps the two-step
`Usuń` → `Na pewno?` wording. `ToothRow` gets the urgency tokens as a status dot —
the first use of the clinical palette, and a rehearsal for S-06.

### Success Criteria

#### Automated Verification

- `npm run lint` exits 0, `npx astro check` 0 errors
- `npm test` passes
- `npm run test:e2e` passes 4/4 — covers the list round-trip and the approval path
- `npm run depcruise` reports 0 violations

#### Manual Verification

- A draft can be created, saved, reopened, and deleted
- The action bar stays reachable with 20 teeth in the form, and does not cover the last row
- The note prefill still fills the form and still shows its warnings
- An approved quote opens read-only with its link

---

## Phase 4: The patient page

### Overview

The hero. Structure changes here, not just styling.

### Changes Required

#### 1. Orchestrator

**File**: `src/components/patient/PatientQuote.astro`

**Intent**: Lead with the answer. Reorder so the variant comparison comes first
and the tooth inventory reads as its evidence.

**Contract**: New order — header, `VariantComparison`, `ToothGroups`,
`DeferredSection`, `ScenariosSection`, `Disclaimer`. The bucketing logic
(`in-plan` / `out-of-current-plan` / `uncertain`) and the props are unchanged.
The meta line becomes a sentence instead of a `·`-joined string. Renders only
`content` — no name, no e-mail, no identifier (FR-066).

#### 2. Variant comparison

**File**: `src/components/patient/VariantComparison.astro`

**Intent**: Draw the two options as shade tabs, marking the recommendation by
weight and by words rather than by colour.

**Contract**: Both headings keep their exact text (`Leczenie w kilku wizytach`,
`Leczenie w znieczuleniu (jedna sesja)`) and stay `<h3>` under the section's
`<h2>`. The anesthesia tab keeps its `rekomendowane przez gabinet` marker. Money
is Archivo with `tabular-nums`, right-aligned. At 375px the tabs stack, each
keeping its own total. This is where the page's single orchestrated entrance
lives: a 220 ms rise, 60 ms apart, on these two elements only, removed entirely
under `prefers-reduced-motion: reduce`.

#### 3. Tooth groups

**File**: `src/components/patient/ToothGroups.astro`

**Intent**: Lay the quadrants out in true chart orientation and drop the
tracked-capitals label treatment.

**Contract**: The four `GROUPS` and their quadrant mapping are unchanged. The 2×2
grid is ordered upper-row-then-lower-row. Quadrant headings become sentence case
in Archivo over a hairline rule (`uppercase tracking-wide` is removed). Urgency
renders through the clinical tokens; treatment and urgency labels still come from
`TREATMENT_LABELS` / `URGENCY_LABELS`.

#### 4. Deferred, scenarios, disclaimer

**Files**: `src/components/patient/{DeferredSection,ScenariosSection,Disclaimer}.astro`

**Intent**: Apply the brief's status rules, so plan status survives print and
colour-blindness.

**Contract**: `DeferredSection` at 55% opacity with a hatched rule;
`ScenariosSection` under a dashed rule. `Disclaimer` **keeps
`role="note"`, `aria-label="Zastrzeżenie"`, and the sentence `To jest kosztorys
szacunkowy`** — all three are asserted — and is set as a colophon at the foot.

#### 5. Error page

**File**: `src/components/patient/PatientError.astro`

**Intent**: Restyle without disclosing anything.

**Contract**: Heading text `Link nieaktywny lub nieprawidłowy` is unchanged. The
page must stay byte-identical between a well-formed unknown token and a malformed
one, and its body must not contain `quotes`, `draft`, or `patient_email` — which
includes any CSS inlined into it.

#### 6. Print

**File**: `src/styles/global.css` (print block) or a scoped block on the page

**Intent**: Make the estimate printable, and leave the QR slot S-07 needs.

**Contract**: `@media print` — white ground, black ink, the two tabs still side
by side, chrome hidden, the disclaimer kept, the grip edge surviving as a solid
bar. A reserved footer area for the future QR.

### Success Criteria

#### Automated Verification

- `npm run test:e2e` passes 4/4 — `patient-link-content` and `patient-link-probe` both exercise this page
- `npm run lint` exits 0, `npx astro check` 0 errors
- `npm run build` completes

#### Manual Verification

- An approved quote reads well at 375px and at 1280px, with the comparison first
- Print preview puts the two variants side by side on one page
- The deferred and uncertain sections are distinguishable in greyscale
- The entrance animation is absent with `prefers-reduced-motion: reduce`

---

## Phase 5: Starter cleanup and README

### Overview

Delete what the redesign orphaned, and describe what the product now looks like.

### Changes Required

#### 1. Delete starter pages

**Files**: `src/pages/dashboard.astro`, `src/components/Welcome.astro`,
`src/components/ui/LibBadge.astro`

**Intent**: Remove the scaffold. All three are starter output with no remaining
consumer once phase 2 rewrites `index.astro`.

**Contract**: Verify zero references before deleting (`grep -rn` across `src/`,
`e2e/`, `README.md`). `/dashboard` also comes out of `PROTECTED_ROUTES` in
`src/middleware.ts:4` — it is the only other reference, and leaving a protected
route pointing at a deleted page is a redirect loop waiting to be found.

#### 2. README

**File**: `README.md`

**Intent**: Describe the application as it now looks, and record the font
dependency.

**Contract**: A short note on the visual identity and the two bundled families,
pointing at `context/changes/ui-redesign/design-brief.md` for the reasoning. No
badges, no screenshots-as-decoration.

### Success Criteria

#### Automated Verification

- `grep -rn "dashboard\|Welcome\|LibBadge\|bg-cosmic" src/ e2e/` returns nothing
- `npm run lint` exits 0, `npx astro check` 0 errors, `npm test` passes
- `npm run build` completes
- `npm run test:e2e` passes 4/4
- `git diff main...HEAD -- e2e/*.spec.ts playwright.config.ts` is empty

#### Manual Verification

- `/dashboard` returns a 404 rather than redirecting anywhere
- README reads as a product document

---

## Testing Strategy

### Unit tests

No new unit tests: this change adds no logic. The existing 61 must stay green,
and `src/lib/config-status.test.ts` in particular is what catches the banner
filter going missing from `Layout.astro`.

### E2E

The suite is the regression gate, unchanged. It runs after **every** phase, not
just at the end, so a red result names the phase that caused it. A failing test
after a visual change is a phase defect, never a reason to edit the test.

The one edit under `e2e/` is the `waitForIslands` wait in `auth.setup.ts`,
justified in _Critical Implementation Details_.

### Manual testing steps

1. Sign in, create a draft with three teeth and a general item, save, reopen from the list, delete it.
2. Paste a note, run the prefill, confirm the warnings render, approve, open the patient link anonymously.
3. Read that patient page at 375px; print-preview it.
4. Remove `ANTHROPIC_API_KEY` from `.dev.vars`, confirm the banner appears in the panel and **not** on the patient page.
5. Re-run every page with `prefers-reduced-motion: reduce`.

## Performance Considerations

Two variable webfonts add two `woff2` requests on first paint. Both are
`unicode-range`-split, so a Polish reader fetches the `latin` and `latin-ext`
cuts only, and both use `font-display: swap` — text is readable before the fonts
land. They are static assets on Cloudflare's edge, not worker bundle weight.

The measurable cost lands on hydration timing, which is why phase 1 carries the
`auth.setup.ts` wait.

## Migration Notes

Nothing to migrate: no schema change, no stored data touched. Approved quotes are
frozen `content` trees (FR-053) and re-render through the new components
unchanged — the demo quote from S-02 (`/p/DuNq4BYwMCOLQuEj1XDASA`) is the
verification that this holds.

Rollback is `git revert -m 1 <merge-sha>` through a PR.

## References

- Design brief: `context/changes/ui-redesign/design-brief.md`
- Frozen locators: `e2e/*.spec.ts`, `e2e/support/app.ts`
- Banner invariant: `src/lib/config-status.test.ts`, FR-060 in `context/foundation/prd.md`
- Prior slice that established the per-phase-commit rhythm: `context/archive/2026-09-05-llm-parsing-prefill/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Tokens, type, and chrome

#### Automated

- [ ] 1.1 `npm run lint` exits 0
- [ ] 1.2 `npx astro check` reports 0 errors
- [ ] 1.3 `npm test` passes
- [ ] 1.4 `npm run build` completes
- [ ] 1.5 `npm run test:e2e` passes 4/4
- [ ] 1.6 no `quotes:` property in `global.css`

#### Manual

- [ ] 1.7 Every page in Literata/Archivo with correct Polish diacritics
- [ ] 1.8 No purple, no cosmic gradient, no neutral `oklch(L 0 0)` left
- [ ] 1.9 Config banner shows for the dentist and not on `/p/<token>`

### Phase 2: Landing and auth

#### Automated

- [ ] 2.1 `npm run lint` exits 0, `astro check` 0 errors
- [ ] 2.2 `npm run test:e2e` passes 4/4
- [ ] 2.3 `npm run build` completes

#### Manual

- [ ] 2.4 `/` fits one screen at 1280×800 and reads at 375px
- [ ] 2.5 `/auth/signin` has no glass or gradient and shows visible focus
- [ ] 2.6 Sign-up and confirm-email match sign-in

### Phase 3: Panel and editor

#### Automated

- [ ] 3.1 `npm run lint` exits 0, `astro check` 0 errors
- [ ] 3.2 `npm test` passes
- [ ] 3.3 `npm run test:e2e` passes 4/4
- [ ] 3.4 `npm run depcruise` 0 violations

#### Manual

- [ ] 3.5 Draft creates, saves, reopens, deletes
- [ ] 3.6 Action bar reachable with 20 teeth and covers nothing
- [ ] 3.7 Note prefill still fills the form and shows warnings
- [ ] 3.8 Approved quote opens read-only with its link

### Phase 4: The patient page

#### Automated

- [ ] 4.1 `npm run test:e2e` passes 4/4
- [ ] 4.2 `npm run lint` exits 0, `astro check` 0 errors
- [ ] 4.3 `npm run build` completes

#### Manual

- [ ] 4.4 Reads well at 375px and 1280px, comparison first
- [ ] 4.5 Print preview keeps both variants side by side
- [ ] 4.6 Deferred and uncertain distinguishable in greyscale
- [ ] 4.7 Entrance absent under `prefers-reduced-motion`

### Phase 5: Starter cleanup and README

#### Automated

- [ ] 5.1 `grep` finds no `dashboard`/`Welcome`/`LibBadge`/`bg-cosmic` in `src/` or `e2e/`
- [ ] 5.2 `npm run lint` exits 0, `astro check` 0 errors, `npm test` passes
- [ ] 5.3 `npm run build` completes
- [ ] 5.4 `npm run test:e2e` passes 4/4
- [ ] 5.5 `git diff main...HEAD -- e2e/*.spec.ts playwright.config.ts` is empty

#### Manual

- [ ] 5.6 `/dashboard` 404s rather than redirecting
- [ ] 5.7 README reads as a product document
