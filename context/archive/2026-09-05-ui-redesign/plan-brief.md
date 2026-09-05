# UI redesign — Plan Brief

> Full plan: `context/changes/ui-redesign/plan.md`
> Design brief: `context/changes/ui-redesign/design-brief.md`

## What & Why

DentiPlan currently looks like two starters stacked on each other: shadcn's
untouched grayscale on the pages we built, and the Astro starter's purple cosmic
gradient on the pages we never rewrote — including `/`, the front door. This
change gives the product one visual identity, executed across every page.

The patient page is why it matters. Someone reads their treatment estimate on a
phone right after leaving the chair, deciding between several appointments and
one session under anesthesia. That page should read as a document from a
practice, not as a demo.

## Starting Point

Seven surfaces on shadcn's neutral tokens (`oklch(L 0 0)`, `--radius: 0.625rem`),
no `@font-face` anywhere, and four live starter artifacts (`Welcome.astro`,
`LibBadge.astro`, `dashboard.astro`, the `bg-cosmic` utility). The domain pages
are built correctly on tokens, which is what makes a retheme cheap. 61 unit tests
and 4 E2E specs are green on `main`.

## Desired End State

Every page set in Literata and Archivo on an enamel-and-ink palette where
saturated colour is reserved for clinical meaning. The patient page opens with
the two treatment variants side by side as shade tabs, the recommended one marked
by weight and by words rather than by being brighter, printable, and readable at
375px. No starter page survives.

## Key Decisions Made

| Decision                   | Choice                                                | Why                                                                                                                            | Source                 |
| -------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| Palette origin             | Enamel ground, blue-black ink, low chroma chrome      | A near-white warm ground avoids the generated-page cream; ink over grey keeps it from reading as a dashboard                   | Design brief           |
| What colour is for         | Reserved for urgency and status only                  | Makes S-06's tooth chart the payoff of the system rather than a coloured drawing on a coloured page                            | Design brief           |
| Marking the recommendation | Heavier grip edge + saying so in words                | A recommendation on a medical bill that shouts is one nobody trusts                                                            | Design brief           |
| Status encoding            | Outline and opacity, never hue alone                  | Survives print, greyscale, and colour-blindness — and gives S-06 its drawing rules                                             | Design brief           |
| Clinical hues              | Ship twice: a `-mark` fill and an `-ink` text value   | One value per hue is how charts end up with unreadable labels                                                                  | Design brief           |
| Typefaces                  | Literata (reading) + Archivo (interface, all numbers) | Inverted from the usual pairing: the patient page is prose, the panel is a tool. Archivo's tabular figures align money columns | Design brief           |
| Font delivery              | `@fontsource-variable/*` from npm, bundled            | A Worker serving a document behind a capability token should not hand a font CDN a request log                                 | Design brief / plan §5 |
| Patient page order         | Comparison moves to the top                           | The reader's question is "how much and which way"; the tooth list is the evidence, not the answer                              | Plan                   |
| Topbar                     | Rebuilt as panel chrome, not deleted                  | Its only consumer was the starter, and three admin pages each repeat their own `Zalogowano:` line                              | Plan                   |
| `e2e/` edits               | One exception: `waitForIslands` in `auth.setup.ts`    | Two webfonts slow hydration; the suite's own rule is to wait for state. No assertion or locator changes                        | Plan                   |

## Scope

**In scope:** tokens and `global.css`; two font packages; `Layout`, `Banner`,
`Topbar`; the `ui/` primitives and `controls.tsx`; landing; the three auth pages
and their form components; admin list; both editor pages and `QuoteEditor` plus
its nine sub-components; all six patient components; `@media print`; deleting
`dashboard.astro`, `Welcome.astro`, `LibBadge.astro`; README.

**Out of scope:** dark mode (tokens stay, design does not); WCAG audit; copy
changes beyond two typographic ones; any behaviour, route, or payload change; new
dependencies beyond the fonts; the tooth chart itself (S-06).

## Architecture / Approach

Bottom-up. Tokens and chrome first so the retheme reaches everything before any
page is restructured, then pages cheapest-first with the hero last. The only
structural change is on the patient page, where the variant comparison moves
above the tooth inventory and the quadrant grid is laid out in true dental-chart
orientation — which leaves S-06 a rectangle to replace with a drawing instead of
a section to rebuild.

The E2E suite is the regression gate and runs after every phase, so a red result
names one phase rather than "somewhere in the redesign".

## Phases at a Glance

| Phase                   | What it delivers                                                         | Key risk                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| 1. Tokens, type, chrome | Palette, clinical tokens, two fonts, `Layout`, `Banner`, `Topbar`, `ui/` | Losing `Layout.astro`'s banner filter would put an admin warning on a patient's page (FR-060)                     |
| 2. Landing and auth     | New front door, auth pages off the cosmic gradient                       | The sign-in form's English labels are test contracts and must not be tidied                                       |
| 3. Panel and editor     | Admin list, both editor pages, `QuoteEditor` + sub-components            | Longest screen in the app; the list must stay a real `<table>` and the confirmation must keep exactly one textbox |
| 4. The patient page     | Reordered hero, shade tabs, status rules, print                          | The error page is asserted on served bytes — inlined CSS must not contain `quotes` or `draft`                     |
| 5. Cleanup and README   | Starter deleted, `/dashboard` out of `PROTECTED_ROUTES`, README          | A protected route pointing at a deleted page is a redirect loop                                                   |

**Prerequisites:** `main` green, zero open PRs, `npm run test:e2e` green locally
before starting (all confirmed at session start). Warm the dev server first —
the suite is flaky on a cold `astro dev`.

**Estimated effort:** one session, five phases, one commit per phase.

## Open Risks & Assumptions

- **The visual direction is unaccepted (B8).** The brief was written and
  committed; the user's "ok" or correction is outstanding. A correction is cheap
  while it is confined to tokens in one file and expensive after phase 4.
- **Polishing has no natural end.** Timebox: one phase per surface, "looks
  right" rather than "perfect".
- Two bundled webfonts slow first paint, which makes the known cold-start E2E
  flake more likely. Mitigated in phase 1, but a red first run on a cold server
  should be re-run warm before being believed.

## Success Criteria (Summary)

- Every page carries the new identity, and no starter artifact remains.
- `npm run test:e2e` green **with no diff under `e2e/*.spec.ts`** — the redesign
  changed how the app looks, not what it is.
- An approved quote from before the change renders correctly in the new design,
  reads at 375px, and prints.
