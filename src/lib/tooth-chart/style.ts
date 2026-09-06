// Per-tooth class composition for the chart (S-06).
//
// Composes only. The tables live in `src/lib/quote/marks.ts` beside the list's
// and the editor's, which is the whole reason that file exists; defining a
// fourth copy here would recreate the problem it was extracted to solve.

import { STATUS_SHAPE, URGENCY_FILL } from "@/lib/quote/marks";
import { cn } from "@/lib/utils";

import type { ChartTooth } from "./model";

/** `<pattern>` id for the `out-of-current-plan` hairline hatch. */
export const HATCH_PATTERN_ID = "tooth-chart-hatch";

/**
 * Classes for one tooth's `<path>`.
 *
 * A tooth the quote does not hold is drawn as an outline and nothing else — a
 * neutral fill on every unplanned tooth would be noise that says nothing, the
 * same rule `URGENCY_MARK` follows in the list.
 *
 * The 65% dim that `out-of-current-plan` carries applies to the tooth's path
 * here and must NOT be repeated on its label: two dims multiply, and the second
 * one put clinical text under the AA contrast floor the last time
 * (`lessons.md`, composed dimming).
 */
export function toothClasses(tooth: ChartTooth): string {
  if (!tooth.inQuote || tooth.status === null) {
    return cn("fill-none stroke-border [stroke-width:1]");
  }
  return cn(URGENCY_FILL[tooth.urgency ?? "unknown"], STATUS_SHAPE[tooth.status]);
}
