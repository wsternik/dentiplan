// Pure two-variant cost engine (S-01, Phase 1).
//
// Single source of truth for ALL money math: derives both plan variants'
// totals from a quote's `content`. Consumed by the live editor preview
// (Phase 2, in the browser island) and the server-side approval freeze
// (Phase 3, in the Workers request handler), so the dentystka sees exactly the
// number that gets immutably stored.
//
// PURITY CONTRACT: no DOM, no IO, no React/Astro/DB imports. Inputs are a
// `QuoteContent` tree (already carrying resolved `PricelistItemRef`s) plus the
// `ANESTHESIA_FEE_SCHEDULE` constants. Output is a `QuoteTotals`. The schedule
// import resolves to F-02's load-time-validated constants and pulls in no IO.

import { ANESTHESIA_FEE_SCHEDULE } from "@/lib/pricing";
import {
  dentitionForTooth,
  type CostRange,
  type PriceValue,
  type PricelistItemRef,
  type QuoteContent,
  type QuoteTotals,
  type ToothEntry,
} from "@/types";

// ---------------------------------------------------------------------------
// Range arithmetic (local helpers, FR-026)
// ---------------------------------------------------------------------------

/** The additive identity: a zero-cost range. */
const ZERO_RANGE: CostRange = { min: 0, max: 0 };

/** Lift a scalar (e.g. a fixed amount or the anesthesia fee) into a range. */
function scalarToRange(amount: number): CostRange {
  return { min: amount, max: amount };
}

/** Sum two ranges component-wise: mins add, maxes add (FR-026). */
function addRanges(a: CostRange, b: CostRange): CostRange {
  return { min: a.min + b.min, max: a.max + b.max };
}

/**
 * A single pricelist item's contribution to a cost range:
 * - `fixed` / `modifier` — a point amount on both bounds. `modifier` is an
 *   additive surcharge attached to the tooth's other items (FR per types.ts);
 *   for summation it is mathematically identical to `fixed` — the "not a
 *   standalone line" distinction is a patient-page presentation concern, not a
 *   cost-math one.
 * - `range` — its own `min`/`max` (FR-026).
 * - `from` — reserved/unused today; treated as a fixed lower bound (the `amount`
 *   on both bounds) so a future appearance never silently drops cost.
 */
function priceToRange(price: PriceValue): CostRange {
  switch (price.kind) {
    case "fixed":
    case "modifier":
    case "from":
      return scalarToRange(price.amount);
    case "range":
      return { min: price.min, max: price.max };
  }
}

/**
 * Sum a tooth's (or general slot's) pricelist items into one range. When
 * `skipLocalAnesthesia` is set (the anesthesia variant, FR-041) items flagged
 * `localAnesthesia` are dropped from the sum.
 *
 * Exported for S-06's tooth chart, whose tooltip shows a tooth's contribution to
 * the standard plan. It calls this rather than summing again: two cost paths
 * that can disagree are the defect class this file exists to prevent, and a
 * tooltip whose arithmetic contradicts the total printed underneath it is the
 * worst version of it.
 */
export function sumItems(items: PricelistItemRef[], skipLocalAnesthesia = false): CostRange {
  return items.reduce<CostRange>((acc, item) => {
    if (skipLocalAnesthesia && item.localAnesthesia) return acc;
    return addRanges(acc, priceToRange(item.price));
  }, ZERO_RANGE);
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

/**
 * Compute both plan-variant totals for a quote's content.
 *
 * Only `in-plan` teeth contribute to either variant; `uncertain` and
 * `out-of-current-plan` teeth are excluded from totals and from the anesthesia
 * tooth count (FR-040/FR-044). General items always contribute.
 *
 * **Standard plan** (FR-032): every in-plan tooth's items + all general items,
 * grouped per `visitNumber` into `perVisit[]` (only items carrying a non-null
 * `visitNumber` land in a visit bucket) and aggregated into `grandTotal` (all
 * in-plan teeth + all general items, regardless of visit assignment).
 *
 * **Anesthesia plan** (FR-041/FR-042/FR-043): the same in-plan tooth set with
 * `localAnesthesia` items removed, plus all general items, plus the fee. The
 * fee is `basePermanent` if any in-plan tooth is permanent else `baseMilk`
 * (FR-042), plus `perExtraTooth` for each in-plan tooth beyond `includedTeeth`
 * (FR-043; count is the number of in-plan ToothEntry, FR-044). An empty in-plan
 * set yields the `baseMilk` floor — the editor disables approval on empty
 * quotes, so this only ever surfaces as a live-preview floor.
 */
export function computeQuoteTotals(content: QuoteContent): QuoteTotals {
  const inPlanTeeth = content.teeth.filter((tooth) => tooth.status === "in-plan");

  // --- Standard plan ---
  const perVisitMap = new Map<number, CostRange>();
  let standardGrandTotal: CostRange = ZERO_RANGE;

  const accumulate = (visitNumber: number | null, cost: CostRange): void => {
    standardGrandTotal = addRanges(standardGrandTotal, cost);
    if (visitNumber !== null) {
      perVisitMap.set(visitNumber, addRanges(perVisitMap.get(visitNumber) ?? ZERO_RANGE, cost));
    }
  };

  for (const tooth of inPlanTeeth) {
    accumulate(tooth.visitNumber, sumItems(tooth.pricelistItems));
  }
  for (const general of content.generalItems) {
    accumulate(general.visitNumber, priceToRange(general.item.price));
  }

  const perVisit = [...perVisitMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([visitNumber, cost]) => ({ visitNumber, cost }));

  // --- Anesthesia plan ---
  const fee = anesthesiaFee(inPlanTeeth);
  const treatmentSum = inPlanTeeth.reduce<CostRange>(
    (acc, tooth) => addRanges(acc, sumItems(tooth.pricelistItems, true)),
    ZERO_RANGE,
  );
  const generalSum = content.generalItems.reduce<CostRange>(
    (acc, general) => addRanges(acc, priceToRange(general.item.price)),
    ZERO_RANGE,
  );
  const anesthesiaTotal = addRanges(addRanges(treatmentSum, generalSum), scalarToRange(fee));

  return {
    standard: { perVisit, grandTotal: standardGrandTotal },
    anesthesia: { fee, total: anesthesiaTotal },
  };
}

/**
 * The anesthesia session fee (FR-042/FR-043): base tier by dentition, plus a
 * per-tooth surcharge for in-plan teeth beyond the included count.
 */
function anesthesiaFee(inPlanTeeth: ToothEntry[]): number {
  const { baseMilk, basePermanent, perExtraTooth, includedTeeth } = ANESTHESIA_FEE_SCHEDULE;
  const anyPermanent = inPlanTeeth.some((tooth) => dentitionForTooth(tooth.number) === "permanent");
  const base = anyPermanent ? basePermanent : baseMilk;
  const extraTeeth = Math.max(0, inPlanTeeth.length - includedTeeth);
  return base + extraTeeth * perExtraTooth;
}
