// Quote content → what the chart draws (S-06).
//
// Pure, no DOM, no IO. The component holds no domain logic: it receives
// `ChartTooth[]` and renders it. Everything that has to agree with the rest of
// the patient page — the Polish name, the labels, the money — is decided here,
// next to the functions that already own those answers.

import { sumItems } from "@/lib/quote/cost";
import { STATUS_LABELS, TREATMENT_LABELS } from "@/lib/quote/labels";
import { toothName } from "@/lib/quote/tooth-name";
import type { CostRange, QuoteContent, ToothStatus, TreatmentType, Urgency } from "@/types";

import { chartPositions, type ChartPosition } from "./layout";

/** A position on the chart plus whatever the quote says about it. */
export interface ChartTooth extends ChartPosition {
  /** Polish anatomical name, e.g. `"74 — pierwszy trzonowiec mleczny lewy dolny"`. */
  name: string;
  /** True when this tooth appears in the quote; false for the rest of the mouth. */
  inQuote: boolean;
  urgency: Urgency | null;
  status: ToothStatus | null;
  treatmentType: TreatmentType | null;
  /** Polish treatment label, or `null` when the quote records no treatment. */
  treatmentLabel: string | null;
  /** Polish status label, or `null` for a tooth the quote does not hold. */
  statusLabel: string | null;
  /**
   * The tooth's contribution to the **standard plan**, or `null` when it has
   * none. Two facts from `cost.ts` make this the only honest number here.
   *
   * The anesthesia variant drops `localAnesthesia` items and then adds a fee
   * that is a property of the whole set (`base + max(0, n - included) *
   * perExtraTooth`); it cannot be attributed to one tooth without inventing an
   * allocation, so it stays where it already lives — in the variant comparison,
   * which owns the set-level number. And only `in-plan` teeth contribute to any
   * total the patient is shown, so an `uncertain` or `out-of-current-plan`
   * tooth has a non-zero item sum but a zero contribution.
   *
   * So: populated only for `in-plan` teeth, and the tooltip labels it as the
   * standard-plan amount rather than as "the cost of this tooth".
   */
  cost: CostRange | null;
}

/**
 * Turn a quote's content into the chart's full set of drawable teeth — every
 * position in the mouth, not only the ones in the plan. A tooth the quote does
 * not hold comes back with `inQuote: false`, no urgency and no cost, because
 * the chart still has to draw it.
 */
export function toChartTeeth(content: QuoteContent): ChartTooth[] {
  const byNumber = new Map(content.teeth.map((tooth) => [tooth.number, tooth]));

  return chartPositions(content.teeth).map((position) => {
    const entry = byNumber.get(position.number);
    return {
      ...position,
      name: toothName(position.number),
      inQuote: entry !== undefined,
      urgency: entry?.urgency ?? null,
      status: entry?.status ?? null,
      treatmentType: entry?.treatmentType ?? null,
      treatmentLabel: entry?.treatmentType ? TREATMENT_LABELS[entry.treatmentType] : null,
      statusLabel: entry ? STATUS_LABELS[entry.status] : null,
      cost: entry?.status === "in-plan" ? sumItems(entry.pricelistItems) : null,
    };
  });
}
