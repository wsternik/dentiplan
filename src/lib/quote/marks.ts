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
 * Outline treatment for a tooth's plan status. Deliberately no opacity: dimming
 * a container also dims whatever sits inside it, which on a form makes live
 * controls look disabled and pushes muted text under the contrast floor.
 */
export const STATUS_OUTLINE: Record<ToothStatus, string> = {
  "in-plan": "border-border",
  uncertain: "border-border border-dashed",
  "out-of-current-plan": "border-border border-dashed bg-muted/40",
};
