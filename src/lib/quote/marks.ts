// Presentational marks for the clinical enums, next to `labels.ts` for the same
// reason that file exists: the admin editor and the patient page must say the
// same thing about a tooth, and S-06's tooth chart will be the third surface to
// need it.
//
// Two rules, from `context/changes/ui-redesign/design-brief.md`:
//
//   - Urgency is a MARK — a fill. Each hue also has an `-ink` variant for text
//     set in that colour, because several marks lack the contrast to carry type.
//   - Status is NEVER a hue. It is an outline treatment, so it survives being
//     printed in black and white and being read by someone who cannot separate
//     red from green.
//
// Tailwind resolves class names at build time by scanning source, so these are
// static lookup tables and never interpolated strings.

import type { ToothStatus, Urgency } from "@/types";

/**
 * Fill for a tooth's urgency. `Urgency` has three members; "not recorded" is
 * `null`, and a tooth without one shows no mark — a neutral dot on every
 * unfilled tooth would be noise that says nothing.
 */
export const URGENCY_MARK: Record<Urgency, string> = {
  urgent: "bg-urgency-urgent",
  moderate: "bg-urgency-moderate",
  mild: "bg-urgency-mild",
};

/**
 * Outline treatment for a tooth's plan status.
 *
 * Deliberately no CSS `opacity`: that dims a container AND everything inside it,
 * which on a form makes live controls look disabled and multiplies with muted
 * text until it falls under the contrast floor. Both of those were real defects
 * here before review caught them.
 *
 * `bg-muted/40` is a different mechanism and is safe: an alpha channel on one
 * element's background does not cascade to descendants, so the text on top keeps
 * its full contrast. The rule is "no inherited transparency", not "no alpha".
 */
export const STATUS_OUTLINE: Record<ToothStatus, string> = {
  "in-plan": "border-border",
  uncertain: "border-border border-dashed",
  "out-of-current-plan": "border-border border-dashed bg-muted/40",
};

// ---------------------------------------------------------------------------
// SVG expression of the same two enums (S-06's tooth chart)
// ---------------------------------------------------------------------------
//
// The chart is the third consumer this file was extracted for, and it cannot
// reuse the two tables above: their values are `bg-*` and `border-*`, which do
// nothing on an SVG `<path>`. The chart needs `fill-*` and `stroke-*`. All
// three tables live here anyway, because the thing worth preventing is not
// duplicate strings — it is a surface that says something different about a
// tooth than the surface next to it. A reviewer changing an urgency's meaning
// sees every place it is expressed, in one file.

/**
 * Fill for a tooth's urgency on the chart.
 *
 * Carries the `unknown` key that `URGENCY_MARK` deliberately lacks: a list can
 * omit a dot next to a tooth whose urgency was never recorded, but a chart
 * cannot omit the tooth. `--urgency-unknown` exists for exactly this.
 */
export const URGENCY_FILL: Record<Urgency | "unknown", string> = {
  urgent: "fill-urgency-urgent",
  moderate: "fill-urgency-moderate",
  mild: "fill-urgency-mild",
  unknown: "fill-urgency-unknown",
};

/**
 * Outline treatment for a tooth's plan status on the chart — the SVG form of
 * `STATUS_OUTLINE`, and the same three distinctions from the design brief:
 * solid, dashed, and dimmed-plus-hatched. None of them is a hue, so all three
 * survive greyscale and a black-and-white printer.
 *
 * The hatch is applied by `style.ts` as an SVG `<pattern>` fill, not as a CSS
 * `repeating-linear-gradient`: browsers drop background images in print unless
 * the reader ticks "Background graphics", and that is a defect this repo has
 * already shipped once (`lessons.md`).
 */
export const STATUS_SHAPE: Record<ToothStatus, string> = {
  "in-plan": "stroke-foreground [stroke-width:1.5]",
  uncertain: "stroke-foreground [stroke-width:1.5] [stroke-dasharray:4_3]",
  "out-of-current-plan": "stroke-foreground [stroke-width:1] [stroke-dasharray:2_2] opacity-65",
};
