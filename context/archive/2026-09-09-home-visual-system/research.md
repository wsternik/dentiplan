---
date: 2026-09-09T12:34:30+02:00
researcher: Wojciech Sternik
git_commit: a3cea4d137f0fe82ea9da3c2c9b41c71f56b4aaf
branch: feat/home-visual-system
repository: dentiplan
topic: "Map the approved home prototype onto every product surface without changing product behaviour, accessibility contracts, clinical meaning, or print"
tags: [research, codebase, visual-system, home, layout, typography, print, e2e]
status: complete
last_updated: 2026-09-09
last_updated_by: Wojciech Sternik
---

# Research: home and visual-system migration

**Date**: 2026-09-09T12:34:30+02:00  
**Researcher**: Wojciech Sternik  
**Git Commit**: `a3cea4d137f0fe82ea9da3c2c9b41c71f56b4aaf`  
**Branch**: `feat/home-visual-system`  
**Repository**: `dentiplan`

## Research Question

How should `prototypes/dentiplan-home/index.html` become the production home and
the visual basis of the auth, admin, editor, patient, and error surfaces without
copying prototype files, changing product behaviour, weakening clinical colour
semantics, breaking existing accessible names, or regressing the A4 document?

## Summary

The prototype is a full direction change, not a page-local skin. Its last CSS
layer deliberately replaces Archivo with Manrope and introduces Fraunces for
editorial headings, while the live product currently assigns Archivo and
Literata global semantic roles. The migration therefore has to change the font
dependencies, global imports, utilities, and every intentional `font-serif`
consumer together (`package.json:29-30`, `src/layouts/Layout.astro:2-8`,
`src/styles/global.css:115-169`).

Five findings shape the implementation plan:

1. **The safe boundary is semantic tokens, not raw prototype colours.** The
   cream, plum, coral, lavender, white, and plum-tinted borders map cleanly onto
   base roles in `global.css`; urgency, tooth status, destructive, and focus are
   a separate language already shared by list and SVG renderers
   (`src/styles/global.css:18-55`, `src/lib/quote/marks.ts:24-88`).
2. **There are three layout measures, not one global container.** Marketing,
   workspace, and patient-document pages have different jobs. Centralized
   gutter/width utilities can replace scattered `max-w-*`, but `Layout.astro`
   must remain a data-free wrapper and cannot automatically render the admin
   topbar (`src/layouts/Layout.astro:20-56`, `src/components/Topbar.astro:12-42`).
3. **The existing E2E suite freezes accessible names and semantic structures.**
   The redesign may move or restyle them, but it cannot rename auth fields,
   editor actions, patient headings, QR regions, or turn the admin table into
   cards. The only new E2E file belongs to the home.
4. **Print is a first-class layout, not a media flag.** The two variants are
   proven side by side at 717 px; status survives through words, strokes, hatch,
   and borders; QR and its full address live in a print-only footer
   (`e2e/patient-print-layout.spec.ts:65-93`, `src/styles/global.css:213-318`).
5. **The prototype itself is input, never product source.** Its two Archivo
   files are stale even inside the prototype because later CSS selects
   Manrope/Fraunces. The production implementation should recreate its
   composition in Astro/Tailwind and ignore precisely
   `/prototypes/dentiplan-home/`.

## Detailed Findings

### Prototype contract and typography

- The production home needs the complete prototype composition: navigation,
  hero, accessible note-to-plan illustration, three-item ribbon, three-step
  explanation, closing call to action, and footer
  (`prototypes/dentiplan-home/index.html:33-46`).
- The prototype contains two visual passes in one stylesheet. The later pass is
  authoritative: Manrope for interface/body/figures and Fraunces only for
  editorial headings (`prototypes/dentiplan-home/index.html:11-28`). Copying the
  stylesheet would preserve contradictory Archivo rules and prototype-only
  controls.
- The live app imports Archivo and Literata once in the shared layout and names
  them through `font-sans`, `font-serif`, and `numeric`
  (`src/layouts/Layout.astro:2-8`, `src/styles/global.css:115-169`). A dependency
  swap must also audit the patient body, because it currently inherits
  `font-serif` from `PatientQuote.astro:49-54`; Fraunces must not accidentally
  become long-form body text.
- Current `font-serif` heading consumers include the home, sign-in, admin list,
  editor, approval confirmation, patient document, and patient error. Their new
  role should be explicit rather than relying on a global synonym
  (`src/pages/index.astro:30,60,82`, `src/pages/auth/signin.astro:24`,
  `src/pages/admin/index.astro:70`, `src/components/admin/QuoteEditor.tsx:585`,
  `src/components/patient/PatientError.astro:11`).

### Tokens, geometry, and shared primitives

- The prototype anchors convert to approximately
  `oklch(0.9825 0.0057 84.6)` background, `oklch(0.2900 0.0440 319.8)`
  foreground/primary, `oklch(0.6780 0.1691 33.2)` brand accent, and
  `oklch(0.9380 0.0124 317.7)` soft surface. White remains the raised card.
- The old enamel/blue-black base occupies the semantic roles in
  `src/styles/global.css:18-34`; replacing those roles centrally reaches every
  surface without spreading raw hex values through components.
- Clinical urgency tokens, their darker text partners, destructive, chart
  values, and ring are already independent concepts
  (`src/styles/global.css:36-76`). The brand coral needs its own token and must
  not silently redefine urgent, destructive, or focus.
- `--radius` fans out through cards, fields, badges, and charts
  (`src/styles/global.css:15,109-113`). Prototype pills belong in a dedicated
  button treatment; inputs and cards remain moderately rounded, while badges
  retain their token shape (`src/components/ui/button.tsx:7-25`,
  `src/components/ui/input.tsx:10-13`, `src/components/ui/badge.tsx:7-18`).
- Shared form and help controls beyond the obvious `ui/` folder include
  `src/components/admin/controls.tsx`, `src/components/auth/FormField.tsx`, and
  `src/components/ui/info-hint.tsx`; they need visual QA after the foundation
  changes.

### Layout and surface map

- All routes use `Layout.astro`, which owns fonts, global CSS, page title, and
  configuration banners. Its session-dependent banner filter must remain
  `Astro.locals.user ? missingConfigs : publicMissingConfigs`, and the wrapper
  must not acquire request-specific output because bad patient-token responses
  are byte-compared (`src/layouts/Layout.astro:20-56`,
  `e2e/patient-link-probe.spec.ts:50-61`).
- `Topbar.astro` is intentionally admin-only. It is rendered by the three
  protected admin routes and must not move into the global layout
  (`src/components/Topbar.astro:12-42`, `src/middleware.ts:6-17`).
- Marketing currently uses `max-w-5xl px-5`; the prototype uses a 1360 px wrap
  with stepped gutters. The new marketing measure should remain local to the
  marketing shell (`src/pages/index.astro:25-105`,
  `prototypes/dentiplan-home/index.html:9`).
- Admin topbar and list share `max-w-5xl px-4`; the editor island owns
  `max-w-4xl px-4`; approval/error states use `max-w-2xl`; the patient document
  uses `max-w-3xl px-5` plus 68-character prose limits
  (`src/components/Topbar.astro:18`, `src/pages/admin/index.astro:67`,
  `src/components/admin/QuoteEditor.tsx:566`,
  `src/components/admin/ApprovalConfirmation.tsx:22`,
  `src/components/patient/PatientQuote.astro:49-54`).
- The correct consolidation is three named layout measures: marketing,
  workspace, and document. Component-local readability constraints such as
  `68ch` and chart sizes stay local.

### Frozen behaviour and accessible names

- Auth retains `lang="en"`, `Email`, `Password`, `Sign in`, and no sign-up path
  (`src/pages/auth/signin.astro:20-28`, `e2e/auth-no-signup.spec.ts:53-57`).
- The admin list remains a real table with `Nowy kosztorys`, `Szkic`, `Usuń`,
  and `Na pewno?`; strict locators also mean the topbar must not duplicate the
  new-quote link (`src/pages/admin/index.astro:67-138`,
  `e2e/seed.spec.ts:25-58`).
- The editor retains the manual disclosure controls, field labels, prefill
  button, focus restoration, `Dodaj`, `Zapisz szkic`, and `Zatwierdź`
  (`e2e/quote-form-disclosure.spec.ts:16-47`,
  `e2e/quote-prefill-reveal.spec.ts:58-73`,
  `e2e/quote-prefill-failure.spec.ts:29-40`,
  `e2e/patient-link-content.spec.ts:39-62`).
- The patient page retains `Twój kosztorys leczenia`, both treatment-variant
  names, `Zastrzeżenie`, and the admin QR region name
  (`e2e/patient-link-content.spec.ts:90-93`,
  `src/components/admin/QrCode.tsx:12-25`).
- No existing spec visits `/`. The new home test should protect one `h1`, the
  two anchor destinations, all practice CTAs to `/auth/signin`, and lack of
  horizontal overflow at 375 px. It should not freeze decorative DOM or pixels
  (`context/foundation/test-plan.md:219-228`).

### Clinical semantics and print

- Urgency is conveyed by a coloured mark plus a word in the tooth list, and by
  fill plus a labelled legend in the chart
  (`src/components/patient/ToothGroups.astro:55-78`,
  `src/components/tooth-chart/ChartLegend.tsx:70-103`).
- Tooth status uses solid, dashed, and dashed-plus-hatch rules defined in
  `src/lib/quote/marks.ts:74-89`, with text labels from
  `src/lib/quote/labels.ts:20-24`. The visual migration must not replace those
  redundant carriers with colour alone.
- Deferred content uses one container opacity on screen. In print the opacity
  is removed and a double border backs up the hatch, because browsers may omit
  backgrounds (`src/components/patient/DeferredSection.astro:37-70`,
  `src/styles/global.css:280-284`).
- The current print contract forces `.variant-grid` to two columns independently
  of the screen breakpoint, removes chrome, keeps chart meaning, and exposes a
  2.5 cm QR plus a wrapping full URL (`src/styles/global.css:174-318`,
  `src/components/patient/PatientQuote.astro:79-82`).
- `e2e/patient-print-layout.spec.ts:65-93` proves comparison geometry at 717 px
  but does not assert the QR or deferred marker. The implementation phase needs
  a real A4 PDF check covering comparison, status, and footer without changing
  the existing spec.

## Code References

- `prototypes/dentiplan-home/index.html:9-46` — approved visual composition and responsive rules.
- `src/styles/global.css:12-318` — global token, font, utility, clinical, and print boundary.
- `src/layouts/Layout.astro:2-56` — global font imports and request-safe banner wrapper.
- `src/pages/index.astro:25-105` — current production home to replace.
- `src/components/Topbar.astro:12-42` — admin-only shared chrome.
- `src/components/admin/QuoteEditor.tsx:566-820` — editor-owned workspace shell and sticky actions.
- `src/components/patient/PatientQuote.astro:49-82` — document shell, hierarchy, and print footer.
- `e2e/patient-print-layout.spec.ts:65-93` — real-width print-layout check.
- `e2e/patient-link-probe.spec.ts:50-61` — byte-identical anonymous error boundary.

## Architecture Insights

The visual system should flow in one direction: semantic foundations in
`global.css`; small shared identity/layout primitives; shared form primitives;
then individual surfaces. Marketing illustration styles stay page-local.
Clinical tokens and renderers form a parallel domain layer that consumes the
new neutral surfaces but does not inherit the brand accent.

The global layout is deliberately a static document wrapper, while Topbar is
authenticated chrome and the page/island owns its content measure. Keeping
those boundaries prevents a cosmetic refactor from leaking configuration or
request data to the patient path.

## Historical Context

- `context/archive/2026-09-05-ui-redesign/design-brief.md` established the
  document-first patient hierarchy, clinical colour redundancy, and three
  print rules that still hold. Its teal/enamel palette and Archivo/Literata
  typography are superseded by the approved prototype.
- `context/foundation/lessons.md` records why print must be measured at the
  medium's dimensions, why backgrounds cannot carry printable meaning, and why
  composed dimming is unsafe on clinical text. Those are implementation
  constraints, not optional polish.
- `context/archive/2026-09-06-patient-link-qr/reviews/plan-review.md` records
  that QR print assertions were consciously deferred; the required A4 artifact
  is the appropriate place to close that visual check.

## Related Research

- `context/archive/2026-09-05-ui-redesign/research.md`
- `context/archive/2026-09-06-tooth-chart-visualization/research.md`
- `context/archive/2026-09-06-patient-link-qr/research.md`

## Open Questions

None. The approved prototype and product constraints settle the visual direction,
font roles, navigation targets, surface scope, print contract, and test boundary.
