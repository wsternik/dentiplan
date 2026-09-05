# Design brief — DentiPlan

> Visual direction for the whole application, worked out with the `frontend-design`
> skill. Written before any code. Everything below is a decision, not a menu:
> the implementation phases (`plan.md`) execute this brief, and where the code
> departs from it the brief is what gets corrected.

## 1. Who is looking, and at what

Two surfaces, two very different readers.

**The patient page `/p/<token>` is the hero.** Someone has just left the chair.
They are on a phone, in a corridor or a car, holding a link the dentist handed
them, and they are about to find out what their mouth is going to cost. They are
comparing two ways of getting the same work done: several appointments spread out,
or all of it in one session under general anesthesia for a fee. They may forward
the link to whoever is paying. They may print it.

This is not an app. It is **a document that is read**, once, carefully, by someone
who is a little frightened of both the treatment and the price. That single fact
drives most of what follows: a reading typeface, a measured single column, real
prose instead of interface chrome, and no cheerfulness.

**The panel and the editor are the tool.** The dentist, on a laptop, between
patients, pasting a note and checking the machine's reading of it before she puts
her name to it. Density, keyboard reach, and knowing at a glance what is a draft
and what is frozen matter more than beauty. It should feel like the same product
as the patient page — same ink, same paper, same voice — set tighter and busier.

## 2. Where the palette comes from

Dentistry's own colour object is the **shade guide**: the fan of enamel tabs a
dentist holds against a tooth to match it. It is the one thing in this world that
exists purely to lay two options side by side and choose one — which is exactly
what the patient page does.

That gives three things, and then we stop referencing it. No tooth illustrations,
no fan graphic, no dental clip art anywhere.

1. **The paper is enamel, not cream.** Near-white, a whisper warm, faintly
   translucent-looking. Not the beige-cream that every generated page is set on.
2. **The tabs are squared with a grip edge.** A shade tab is a flat rectangle with
   a solid coloured spine you hold it by. The two treatment variants are drawn
   that way — which is how we mark one as recommended without making it brighter.
3. **Chrome is low-chroma; colour is clinical.** A shade guide's tabs are all
   near-neutral; the only saturated thing in the room is the pathology. So:

> **The governing rule of this palette — colour means something clinical.**
> Saturated hue is reserved for urgency and status. Navigation, headings, buttons,
> borders, and the recommendation marker are all ink and enamel. If a colour
> appears on screen, it is telling the reader something about a tooth.

This is also what makes the tooth chart (S-06) the visual payoff of the whole
system rather than a coloured drawing dropped onto a coloured page.

### Base tokens

Six named values. All oklch, all replacing shadcn's grayscale defaults in
`src/styles/global.css` under `:root`.

| Token                        | Value                    | Role                                               |
| ---------------------------- | ------------------------ | -------------------------------------------------- |
| `--background` (enamel)      | `oklch(0.985 0.004 95)`  | the paper of every page                            |
| `--card` (porcelain)         | `oklch(1 0 0)`           | fields, tabs, and surfaces that sit _on_ the paper |
| `--foreground` (ink)         | `oklch(0.28 0.042 205)`  | all body text — a blue-black, never a brown-black  |
| `--muted-foreground` (slate) | `oklch(0.505 0.028 205)` | secondary text, labels, meta                       |
| `--border` (hairline)        | `oklch(0.885 0.008 205)` | every rule and outline                             |
| `--primary` (deep ink)       | `oklch(0.33 0.055 205)`  | the recommended variant, primary buttons           |

`--primary-foreground` is enamel. `--secondary` / `--accent` / `--muted` are
enamel stepped one notch darker (`oklch(0.955 0.006 200)`); `--input` and `--ring`
follow the hairline and the ink respectively. `--destructive` is the urgency red
below, so a delete button and an urgent tooth speak the same red.

`--radius: 0.25rem`. shadcn's `0.625rem` is the single most starter-ish thing about
the current build; a shade tab is squared, and the whole component set inherits
the change for free. Badges are the deliberate exception — they stay fully
rounded, because a pill reads as a _token_ and that distinction is useful.

### Clinical tokens

These are the ones S-06 will draw with, which is why they are decided here rather
than invented later next to a half-finished odontogram.

Every clinical hue ships **twice**: a `-mark` value for fills, dots, and strokes,
and an `-ink` value for text set in that colour. The mark values are chosen to be
legible as areas; several of them do not have enough contrast on enamel to carry
text, and shipping only one value per hue is how charts end up with unreadable
labels.

| Token                | mark                     | ink                      | Meaning                                |
| -------------------- | ------------------------ | ------------------------ | -------------------------------------- |
| `--urgency-urgent`   | `oklch(0.545 0.168 27)`  | `oklch(0.455 0.155 27)`  | oxide red — serious, not an alarm bell |
| `--urgency-moderate` | `oklch(0.735 0.135 68)`  | `oklch(0.495 0.105 62)`  | ochre                                  |
| `--urgency-mild`     | `oklch(0.655 0.085 142)` | `oklch(0.455 0.070 142)` | sage — "can wait", not "well done"     |
| `--urgency-unknown`  | `oklch(0.800 0.010 205)` | `oklch(0.505 0.028 205)` | slate, deliberately colourless         |

**Status is never carried by hue.** Three drawing rules, each of which survives
being printed in black and white, being seen by a colour-blind reader, or being
reproduced in the tooth chart:

| Status                | Rule                                 | Also                                               |
| --------------------- | ------------------------------------ | -------------------------------------------------- |
| `in-plan`             | solid fill, solid 1px outline        | the default, needs no marking                      |
| `uncertain`           | **dashed** outline, unfilled         | sits under a heading that says the cost may change |
| `out-of-current-plan` | 55% opacity, hairline diagonal hatch | sits under its own "Odroczone" heading             |

Nothing above depends on the reader distinguishing red from green.

## 3. Type

Two families, both from npm as variable fonts, both bundled. No CDN: a Worker
serving a Polish medical document should not hand a third party a request log
keyed to a capability token, and that is not a decision worth taking for a
webfont. Two `woff2` files, `latin-ext` subset — the Polish diacritics are
non-negotiable and both families ship them.

- **`@fontsource-variable/literata`** — the reading face. Every word of the patient
  document: headings, prose, tooth names, the disclaimer. Literata was drawn for
  e-readers, so it holds together at 16px on a phone held at arm's length, which is
  literally the hero context. It is warm and slightly stubby rather than fashionably
  high-contrast. Its `opsz` axis is used: display sizes take the larger optical
  size, body text the smaller.
- **`@fontsource-variable/archivo`** — the interface face. Every number, every
  label, every button, every table header, and the whole admin panel. Chosen for
  its tabular figures: this is a document about money in columns, and
  `font-variant-numeric: tabular-nums` on a grotesque that was designed with them
  is the difference between a price list and a price table.

The pairing is inverted from the usual sans-body/serif-display arrangement, on
purpose: the patient page is prose to be read and the panel is a tool to be
operated, so the serif does the reading and the sans does the work.

Scale (Elements of Typographic Style, ~1.25 ratio, on a 16px base): 12 / 14 / 16 /
20 / 25 / 31 / 39. Patient body copy is 17px Literata at 1.65 line-height, measure
capped at 68 characters. Panel body is 14px Archivo at 1.5.

Three treatments we do not use, two of which are in the current code and get
removed:

- **No tracked-out capitals for labels.** `ToothGroups.astro`'s quadrant headings
  (`text-xs font-semibold tracking-wide uppercase`) become sentence case in Archivo
  medium above a hairline rule.
- **No middle-dot meta strings.** `Plan dla osoby dorosłej · sporządzono 5 września
2026` becomes a sentence: _Plan dla osoby dorosłej, sporządzony 5 września 2026._
- **No arrows appended to buttons**, no single accented word in a headline, and no
  monospace for data labels — with one earned exception: the admin list's truncated
  quote identifier stays monospace, because it is an eight-character hex string that
  a human compares by eye, which is the one job monospace is actually for.

## 4. Layout

### Patient page — the one that matters

Single measured column, left-aligned throughout. Money right-aligned in its own
column with tabular figures. Nothing on this page is centred; centred body copy is
what a landing page does, and this is a document.

**The comparison moves to the top.** Today the tooth inventory comes first and the
two variants come third. The reader's question is _what will this cost, and which
way_ — the inventory is the evidence for the answer, not the answer. New order:

```
Twój kosztorys leczenia                        ← Literata, 39/1.15
Plan dla osoby dorosłej, sporządzony 5 IX 2026 ← Archivo, slate

┌─────────────────────────────┬─────────────────────────────┐
│▌Leczenie w kilku wizytach   │███Leczenie w znieczuleniu   │
│▌                            │███(jedna sesja)             │
│▌ Wizyta 1           1 200 zł│███rekomendacja gabinetu     │
│▌ Wizyta 2             800 zł│███                          │
│▌ Wizyta 3             400 zł│███Opłata za znieczunie 900zł│
│▌ ─────────────────────────  │███────────────────────────  │
│▌ Razem          od 2 400 zł │███Razem         od 3 300 zł │
└─────────────────────────────┴─────────────────────────────┘
   1px grip edge                  4px solid ink grip edge

Zakres leczenia
┌ Górne prawe ────────┬ Górne lewe ─────────┐   ← 2×2 mirrors a real
│ 17 drugi trzonowiec │ 26 pierwszy trzon.  │     dental chart's
│ 16 pierwszy trzon.  │                     │     orientation, and is
├ Dolne prawe ────────┼ Dolne lewe ─────────┤     the slot S-06 drops
│ 47 …                │ 34 …                │     the odontogram into
└─────────────────────┴─────────────────────┘

Odroczone           (55% opacity, hatched rule)
Scenariusze, które mogą zmienić koszt   (dashed rule)
──────────────────────────────────────────────────
To jest kosztorys szacunkowy            ← colophon at the foot
```

**The variant tab is the one memorable device on the page.** Both variants are the
same squared surface; the recommended one is marked by a **heavier grip edge and by
saying so in words**, never by being brighter or bigger. A recommendation on a
medical bill that shouts is a recommendation nobody trusts.

At 375px the two tabs stack, recommended one second, each carrying its own total —
so the comparison survives without a sticky strip or any other scroll furniture.

The quadrant grid is laid out 2×2 in true chart orientation (upper row above lower
row) rather than as a flowing list. It costs nothing today and means S-06 replaces
a rectangle with a drawing instead of rebuilding a section.

### Panel and editor

Same paper, tighter. The list stays a real `<table>`. The editor — 593 lines and
the longest scroll in the app — gets a **bottom-anchored action bar** holding
"Zapisz szkic" and "Zatwierdź", because today the two actions that end the task
scroll off the screen while you work. Same buttons, same names, same order; only
their position changes.

Warnings from the note-prefill (`ParseWarnings`) sit directly beneath the note
field, in ochre, with a hairline left rule — they are the machine explaining
itself and they belong next to the thing it read, not at the foot of the form.

### Landing

One screen, no scroll on a laptop. The hero is not a headline over a gradient — it
is **the artifact itself**: a small, real rendering of the two variant tabs with
obviously-invented numbers, captioned with what it is. What the practice is buying
is the thing the patient receives, so that is what the front page shows. Beneath
it: one paragraph of what DentiPlan does, and the sign-in link. The starter's
`Welcome.astro` and its cosmic gradient go.

## 5. Motion

**One orchestrated moment in the whole application:** on the patient page, the two
variant tabs settle in on load — a 220 ms rise, 60 ms apart, opacity and 8px of
travel. Nothing else on that page moves by itself.

Everywhere else, motion only answers something the person did: the delete button
arming, the prefill spinner, a field's focus ring. No hover-lift on surfaces, no
section-by-section reveal on scroll, no animation library. `prefers-reduced-motion:
reduce` removes the entrance entirely.

## 6. Print

The patient page is a document, so it must survive being printed. `@media print`:
enamel → white, ink → black, hairlines → 0.5pt grey, the two variant tabs stay
side by side, navigation and the topbar disappear, the disclaimer stays. The grip
edge survives as a 3pt black bar so the recommendation is still marked on paper.

A footer slot is reserved now for the QR code S-07 will put there.

## 7. What this brief does not do

- **No dark mode.** The `.dark` block stays in `global.css` and keeps working, but
  it is not designed, not reviewed, and not screenshotted. A treatment estimate is
  read in daylight and printed on white.
- **No accessibility audit.** Text contrast is checked against the tokens above
  (ink on enamel is far past 12:1; every clinical hue has the `-ink` variant
  precisely so text never rides on a `-mark` value), but WCAG conformance remains a
  PRD non-goal.
- **No copy changes** beyond the two typographic ones named in §3 and whatever a
  new layout forces. In particular the sign-in form keeps its English "Email",
  "Password" and "Sign in" — those are accessible names the E2E suite locates by,
  and this brief does not get to move a test contract for tidiness.
- **No new dependencies** except the two font packages. shadcn is re-themed
  through tokens, not replaced; Tailwind 4 and `tw-animate-css` stay.

## 8. Two hazards to build around

1. **`Layout.astro` filters configuration banners by session**
   (`Astro.locals.user ? missingConfigs : publicMissingConfigs`). Restyling the
   layout must not lose that line: without it the "Anthropic key missing" banner
   appears above an anonymous patient's estimate, against the no-disclosure
   invariant FR-060. `src/lib/config-status.test.ts` guards it.
2. **The patient page is asserted on its served bytes, not its DOM.**
   `patient-link-probe.spec.ts` requires that the error page's response body
   contains neither `quotes` nor `draft` as substrings. Inlined CSS counts. So: no
   `quotes:` CSS property anywhere in `global.css` (it is a real property and a
   real way to fail this test), and no class or custom-property name containing
   either word.
