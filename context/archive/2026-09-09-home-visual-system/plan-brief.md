# Home and visual system — Plan brief

> Full plan: `context/changes/home-visual-system/plan.md`  
> Research: `context/changes/home-visual-system/research.md`  
> Visual contract: `context/changes/home-visual-system/design-brief.md`

## What & Why

Build the approved local home prototype as production `/` and carry its brand
system across every surface. Shipping the new home without shared tokens, type,
identity, and layout would leave two visibly different products.

## Starting Point

DentiPlan has semantic tokens, shared layout, mature editor/patient surfaces,
clinical status colours, and an A4 contract. It uses the previous direction with
Archivo/Literata and has no E2E contract for `/`.

## Desired End State

The home matches the prototype at desktop, tablet, and phone. Every surface uses
Manrope/Fraunces, the new semantic palette, one wordmark, and its correct measure
while behaviour, accessibility, clinical meaning, and print remain intact.

## Key Decisions Made

| Decision       | Choice                                                    | Why                                                                                   | Source                     |
| -------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------- |
| Fonts          | Manrope working/body; Fraunces selected headings          | Matches the final prototype pass without turning long patient prose into display type | Visual contract            |
| Colour         | New semantic base plus separate brand accent              | Keeps decorative coral from becoming urgency/destructive/focus                        | Visual contract + Research |
| Geometry       | Pill primary actions; moderate fields/cards; token badges | Preserves hierarchy instead of applying one global radius                             | Visual contract            |
| Layout         | Marketing, workspace, document measures                   | The three surfaces have different reading/density jobs                                | Research                   |
| Global wrapper | Keep `Layout.astro` static and Topbar explicit            | Preserves banner disclosure and byte-identical patient errors                         | Research                   |
| Testing        | One new home spec; existing specs unchanged               | Protect behaviour without freezing decoration                                         | Research                   |
| Print          | 717 px check plus real A4 PDF                             | Print-media emulation at a wide viewport is insufficient                              | Lessons                    |

## Scope

**In scope:** global tokens, fonts, type roles, measures, wordmark and controls;
the full home plus one home-only E2E spec; every current product surface and
print; dead-style cleanup and product documentation.

**Out of scope:** API, database, auth-flow, LLM, price, approval, or domain
changes; prototype assets, external fonts, animation dependencies, formal
WCAG/dark-mode projects, and edits to existing E2E specs.

## Architecture / Approach

Foundations flow from `global.css` into shared primitives and then one surface
per phase. Marketing art stays local; clinical renderers keep their token family.
Each UI commit is revertable and runs the full E2E suite.

## Phases at a Glance

| Phase              | What it delivers                                                      | Key risk                                             |
| ------------------ | --------------------------------------------------------------------- | ---------------------------------------------------- |
| 1. Foundation      | Fonts, tokens, measures, wordmark, chrome, controls, prototype ignore | Global aliases silently alter every page             |
| 2. Home            | Full prototype composition and home E2E                               | Responsive overflow or decorative test coupling      |
| 3. Entry/workspace | Sign-in, topbar, list, page states, approval                          | Accessible names or table semantics drift            |
| 4. Editor          | Forms, visits, chart, totals, QR, sticky actions                      | React state/interaction changes during styling       |
| 5. Patient/print   | Document, errors, clinical redundancy, real A4                        | Screen success hides paper regression                |
| 6. Contract/docs   | Cleanup, risk #14, roadmap, README, final gates                       | Stale fonts/tokens survive in an overlooked consumer |

**Prerequisites:** clean `main` at `a3cea4d`, local prototype, green CI, no open
PR. Fresh entry E2E was waived; the recorded 9 September baseline is 11/11.  
**Estimated effort:** six bounded implementation tasks plus review and delivery.

## Open Risks & Assumptions

- Manrope's tabular figures and chosen Fontsource entrypoints must be verified
  from the installed package, not assumed from the prototype's CDN declaration.
- Visual review is non-blocking, while semantic contrast and A4 geometry are
  hard gates; decorative motion and micro-polish are the first cuts.

## Success Criteria Summary

- All surfaces visibly share the approved direction at desktop and 375 px.
- Existing names, behaviour, clinical meaning, and A4 print survive; all quality
  gates are green, only the home spec is new, and no prototype/obsolete visual
  asset remains active.
