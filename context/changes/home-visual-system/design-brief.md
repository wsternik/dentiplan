# Design brief — DentiPlan home and visual system

> `prototypes/dentiplan-home/index.html` is the approved visual source. This
> brief translates it into production rules for Astro, Tailwind, shared
> components, and print. The prototype remains local and untracked.

## 1. Direction

DentiPlan should feel calm, editorial, and precise: warm paper, plum ink, a
single coral brand accent, restrained geometry, and generous rhythm. The home
shows the product's transformation — a dentist's note becoming a clear patient
plan — rather than a generic software dashboard.

This direction applies across the whole product. The marketing page gets the
full expressive composition; auth, admin, editor, patient, and error surfaces
use the same type, colour, radii, wordmark, and gutters with density appropriate
to their jobs. Product behaviour and copy already named by tests do not change.

## 2. Source boundary

- Rebuild the prototype in source-native Astro/Tailwind and existing components.
- Do not paste its minified HTML or CSS into the application.
- Do not import or copy either prototype `woff2` file.
- Do not edit anything inside `prototypes/dentiplan-home/`.
- Ignore exactly `/prototypes/dentiplan-home/`; no broader prototype rule.
- `git ls-files -- prototypes/dentiplan-home` must always return nothing.

The prototype's later CSS pass wins where its two passes disagree. In
particular, Manrope/Fraunces supersede the earlier Archivo declaration and pill
buttons supersede the earlier 7 px primary-button shape.

## 3. Typography

Both families are variable npm dependencies with `latin-ext`; there is no font
CDN.

- **Manrope Variable** is the working face: interface, body copy, form fields,
  tables, labels, buttons, patient prose, and all figures.
- **Fraunces Variable** is an accent face only for selected editorial headings:
  the explanatory home section, closing home statement, patient document title,
  major patient section titles, and carefully chosen empty/error headings.
- Long patient prose stays Manrope. A global `font-serif` replacement must not
  turn the whole document into Fraunces.
- Money and columnar values retain tabular figures through the `numeric` utility.
- Remove Archivo/Literata packages and imports only after `rg` confirms no
  active references.

Type should be compact in the workspace and expansive on marketing surfaces.
The home hero follows the prototype's responsive `clamp` scale; patient body
copy retains a readable 17 px / 1.65 setting and a 68-character measure.

## 4. Base palette

The values below are anchors. Production defines semantic OKLCH tokens in
`global.css`; components consume names, never repeated raw values.

| Role                 | Prototype anchor     | OKLCH target                         | Use                                     |
| -------------------- | -------------------- | ------------------------------------ | --------------------------------------- |
| Background           | `#fbf9f5`            | `oklch(0.9825 0.0057 84.6)`          | page ground                             |
| Foreground / primary | `#352439`            | `oklch(0.2900 0.0440 319.8)`         | text, primary control                   |
| Brand accent         | `#ed694e`            | `oklch(0.6780 0.1691 33.2)`          | identity, small highlights              |
| Brand accent ink     | `#d95940`            | `oklch(0.5600 0.1662 32.9)`          | accessible accent text on soft surfaces |
| Soft surface         | `#eee8f0`            | `oklch(0.9380 0.0124 317.7)`         | quiet panels and illustration ground    |
| Card                 | `#ffffff`            | `oklch(1 0 0)`                       | raised surfaces                         |
| Muted text           | `#6d626d`            | `oklch(0.5103 0.0218 325.9)`         | secondary copy                          |
| Border               | plum-tinted hairline | derived from foreground/soft surface | rules and inputs                        |

The brand accent is decorative and identifying. It is not urgency red, delete
red, warning ochre, success green, or the focus ring.

## 5. Clinical colour remains separate

Keep the existing urgency ramp as a distinct semantic family. Recalculate only
where contrast against the new warm background demands it, and keep mark/ink
pairs. The visible rules remain:

- urgency: colour mark plus written label;
- uncertain status: unfilled with a dashed outline plus text;
- outside current plan: hatch/dashed treatment plus its `Odroczone` heading;
- destructive: explicit destructive token, not the brand coral by inheritance;
- focus: visible ring with its own token.

Use one dimming mechanism per subtree. Never dim a container whose controls are
live. Anything that must survive print also has a text, border, stroke, or glyph
carrier; background colour or background image is never enough.

## 6. Geometry and controls

- Primary marketing and panel-entry actions are pills with a separate circular
  icon field, following the prototype.
- Standard form actions may share the pill silhouette where hierarchy calls for
  it, but compact/destructive/table actions remain fit for their context.
- Inputs, textareas, tables, cards, estimate panels, and the odontogram stay
  moderately rounded; a single large global radius must not turn every surface
  into a capsule.
- Badges remain intentional tokens and may stay fully rounded.
- Shadows are low-contrast and reserved for the transformation illustration or
  truly raised surfaces; workspace structure relies mainly on spacing and rules.

Focus states are never removed for visual cleanliness. Links that look like
buttons remain real `<a>` elements when they navigate.

## 7. Identity and layout primitives

Use one shared tooth mark plus `DentiPlan` wordmark on home, auth, admin topbar,
and footer. The mark is decorative inside a labelled link; avoid duplicated
accessible text.

Use three named content measures:

1. **Marketing** — broad enough for the prototype's 1360 px composition, with
   responsive gutters equivalent to 64 / 35 / 25 / 22 px.
2. **Workspace** — the admin list, topbar, editor, approval, and operational
   errors; dense enough for tables/forms and consistent between routes.
3. **Document** — the patient estimate and patient-link error; narrower reading
   measure with component-local `ch` limits.

`Layout.astro` stays a global static wrapper. It owns fonts, global CSS, title,
and configuration banners, but no topbar, request-generated IDs, timestamps,
session-derived markup beyond the existing banner filter, or patient-token data.
Topbar remains explicit on protected admin pages.

## 8. Production home

The home implements the prototype's hierarchy:

1. Header with shared wordmark, `Jak to działa`, `Dla pacjenta`, and panel CTA.
2. Hero with the approved headline and explanatory copy.
3. Accessible note-to-plan illustration with obviously invented data and prices.
4. Ribbon summarizing note, variants, and patient link.
5. Three-step `Jak to działa` section.
6. Closing CTA and shared wordmark footer.

Navigation is fixed:

- `Jak to działa` → `#jak-to-dziala`;
- `Dla pacjenta` → `#dla-pacjenta`;
- `Zobacz przykładowy plan` → `#dla-pacjenta`;
- every practice CTA → `/auth/signin`.

The example is static and labelled as invented. Prices use `formatAmount`; no
session, patient token, database record, or live price list reaches the page.
The phrase `Prototyp kierunku wizualnego` does not ship.

At 1440 px the composition has the prototype's breathing room. At 768 px it
reflows without awkward collisions. At 375 px there is no horizontal overflow,
the illustration remains understandable, actions wrap cleanly, and all target
sections remain reachable by keyboard and anchor navigation.

## 9. Auth and workspace

The sign-in screen uses the shared wordmark, warm ground, moderate card radius,
and Manrope controls. It keeps `lang="en"`, `Email`, `Password`, `Sign in`, the
same submission path, validation, and absence of sign-up.

The admin list and topbar share the workspace measure. The list stays a real
table, including overflow handling on narrow screens. Empty and error states use
the same system without changing their behaviour or accessible names.

The editor adopts the new rhythm one section at a time. Preserve React state,
prefill disclosure and focus behavior, validation, visit controls, odontogram,
QR/link output, and sticky action semantics. Long prefill warnings and the full
flow must work at 375 px.

## 10. Patient document and errors

The patient page remains a document, not a marketing surface. Its order stays:
title/meta, treatment variants, tooth chart, plan list, deferred/uncertain
content, disclaimer, and print footer. Fraunces provides selected hierarchy;
Manrope carries prose and figures.

Variant recommendation remains textual and structural, never just brighter.
The patient error stays static and byte-identical for all unavailable tokens.
Its restyling cannot add route-, time-, token-, or request-dependent output, nor
the forbidden substrings protected by the probe test.

## 11. Print

Print is white and black with grey hairlines. Screen chrome disappears. At an
A4 printable width of about 717 px:

- both treatment variants remain side by side;
- the recommendation remains visible through text and a solid grip edge;
- uncertain/deferred status remains visible without background graphics;
- the odontogram is bounded and its legend remains readable;
- the QR is 2.5 cm, black on white, with quiet zone intact;
- the full `Wersja online:` address wraps without clipping;
- the disclaimer remains in the document.

Verification uses a real A4 PDF or equivalent 717 px print measurement, never a
wide screen with print media merely emulated.

## 12. Motion and responsiveness

Keep the product quiet. Do not add an animation library. The existing short
patient-variant entrance may remain with reduced-motion handling. Home may use
subtle CSS-only emphasis from the prototype, but decorative motion is the first
thing cut if schedule or quality is at risk. No hover-lift system.

## 13. Frozen contracts

Existing roles, field labels, action names, route targets, and patient headings
located by `e2e/` remain unchanged. Existing specs are not edited. A single new
home spec protects CTA destinations, both anchors, semantic heading/sections,
and 375 px document width without snapshotting the decorative implementation.

## 14. Out of scope

- API, database, auth, LLM, price calculation, approval-flow, or domain changes.
- New patient data or a live/example quote fetched from production state.
- External fonts, copied prototype assets, or a new animation library.
- A formal WCAG audit or a designed dark mode.
- Changes to existing E2E specs.
- Editing or committing anything under `prototypes/dentiplan-home/`.
