# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Verifying a media-dependent behaviour needs the medium's dimensions, not just its name

- **Context:** `ui-redesign`, phase 4. The patient page must print with the two
  treatment variants side by side — stated in the design brief and in the plan's
  phase contract.
- **Problem:** The criterion was marked verified against a screenshot taken with
  `emulateMedia({ media: "print" })` at a **1280px viewport**. The grid is
  `md:grid-cols-2` (768px) and A4 at default margins is about 717px of printable
  width, so on real paper the tabs stacked. Emulating the medium changed which
  CSS applied; it did not change the width the breakpoint was evaluated against,
  and the capture showed exactly the expected result. An implementation reviewer
  found it by reading the breakpoint against the paper size.
- **Rule:** When a behaviour depends on a media query, verify it at the
  **dimensions** of that medium, not only under its name. For print, measure at
  the printable width (~717px A4 / ~739px Letter at default margins) or render an
  actual PDF and inspect it — never a print-emulated screenshot at a screen
  viewport. Prefer `sm:` (640px) over `md:` (768px) for any layout that must
  survive printing.
- **Applies to:** every `@media print` rule and every responsive layout with a
  print contract. Immediately relevant to S-07, which puts a QR code on this same
  printed page.

## Print drops background images, so a background cannot carry meaning on paper

- **Context:** `ui-redesign`, phase 4. Deferred teeth are distinguished by dimming
  plus a hatched rule drawn as a `repeating-linear-gradient`.
- **Problem:** Browsers suppress background images in print unless the reader
  ticks "Background graphics", and the print block deliberately removed the
  dimming (opacity prints as grey mush). On paper the section lost both of its
  distinctions at once and deferred teeth looked identical to teeth in the plan —
  the one thing the section exists to prevent, on a document whose whole point is
  being printed.
- **Rule:** Never let a `background-image` or `background-color` be the only
  carrier of meaning on something that gets printed. Add
  `print-color-adjust: exact`, and back it with a property that always prints —
  a border, a glyph, or text. If a distinction matters, it must survive the
  reader's default print settings.
- **Applies to:** the patient page and anything else a patient takes home.

## Composed dimming multiplies, and clinical text has a contrast floor

- **Context:** `ui-redesign`. A section carried `opacity-65`; its descendants
  carried `text-muted-foreground`.
- **Problem:** The two dims multiply. 5.55:1 became 2.72:1 — under the AA floor,
  on patient-facing text about the reader's own mouth. Neither value looks wrong
  on its own.
- **Rule:** Use one dimming mechanism per subtree. If a container is dimmed, its
  text uses the full-strength foreground. Measure composited contrast by painting
  the colour to a canvas — `getComputedStyle().color` returns `oklch()` strings
  in Chrome, and parsing those as RGB gives numbers that look plausible and are
  nonsense.
- **Applies to:** any patient-facing text; the tooth chart in S-06 in particular,
  where marks and labels sit together.

## Do not dim a container whose controls are still live

- **Context:** `ui-redesign`, phase 3. An out-of-plan tooth row was dimmed to 65%.
- **Problem:** Every control inside stayed enabled, so the row read as disabled
  while being fully interactive — and the control needed to put the tooth back
  into the plan was itself the dimmed one.
- **Rule:** Opacity on a container is a claim that everything inside is inactive.
  If the controls still work, signal state with an outline, a ground, or a label
  instead.
- **Applies to:** the editor's status treatments, and any future read-only or
  de-emphasised state.
