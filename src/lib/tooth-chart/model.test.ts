import { describe, expect, it } from "vitest";

import { computeQuoteTotals } from "@/lib/quote/cost";
import type { PricelistItemRef, QuoteContent, ToothEntry } from "@/types";

import { toChartTeeth } from "./model";

let idSeq = 0;
function fixed(amount: number, opts: { localAnesthesia?: boolean } = {}): PricelistItemRef {
  return {
    id: `item-${(idSeq += 1)}`,
    name: `fixed-${amount}`,
    price: { kind: "fixed", amount },
    localAnesthesia: opts.localAnesthesia ?? false,
  };
}

function tooth(overrides: Partial<ToothEntry> & { number: number }): ToothEntry {
  return {
    treatmentType: "filling",
    urgency: "moderate",
    status: "in-plan",
    note: "",
    pricelistItems: [],
    visitNumber: null,
    ...overrides,
  };
}

function content(teeth: ToothEntry[]): QuoteContent {
  return { teeth, visits: [], generalItems: [] };
}

describe("toChartTeeth", () => {
  it("returns an entry for every drawable position, marking the ones the quote holds", () => {
    const chart = toChartTeeth(content([tooth({ number: 11 })]));
    expect(chart.find((t) => t.number === 11)).toMatchObject({ inQuote: true, urgency: "moderate" });
    expect(chart.find((t) => t.number === 26)).toMatchObject({ inQuote: false, urgency: null, cost: null });
  });

  it("names a tooth in Polish, not as a number", () => {
    const chart = toChartTeeth(content([tooth({ number: 74, treatmentType: "extraction" })]));
    expect(chart.find((t) => t.number === 74)).toMatchObject({
      name: "74 — pierwszy trzonowiec mleczny lewy dolny",
      treatmentType: "extraction",
    });
  });

  it("gives a tooth the cost it contributes to the standard plan's grand total", () => {
    const teeth = [
      tooth({ number: 11, pricelistItems: [fixed(300), fixed(200, { localAnesthesia: true })] }),
      tooth({ number: 21, pricelistItems: [fixed(450)] }),
    ];
    const chart = toChartTeeth(content(teeth));
    const totals = computeQuoteTotals(content(teeth));

    expect(chart.find((t) => t.number === 11)?.cost).toEqual({ min: 500, max: 500 });
    expect(chart.find((t) => t.number === 21)?.cost).toEqual({ min: 450, max: 450 });

    const summed = chart.reduce(
      (acc, t) => ({ min: acc.min + (t.cost?.min ?? 0), max: acc.max + (t.cost?.max ?? 0) }),
      { min: 0, max: 0 },
    );
    expect(summed).toEqual(totals.standard?.grandTotal);
  });

  it("carries no cost for a tooth outside the plan, because it contributes none to any total shown", () => {
    const teeth = [
      tooth({ number: 11, status: "in-plan", pricelistItems: [fixed(300)] }),
      tooth({ number: 12, status: "uncertain", pricelistItems: [fixed(900)] }),
      tooth({ number: 13, status: "out-of-current-plan", pricelistItems: [fixed(900)] }),
    ];
    const chart = toChartTeeth(content(teeth));
    expect(chart.find((t) => t.number === 12)).toMatchObject({ inQuote: true, cost: null });
    expect(chart.find((t) => t.number === 13)).toMatchObject({ inQuote: true, cost: null });
    expect(computeQuoteTotals(content(teeth)).standard?.grandTotal).toEqual({ min: 300, max: 300 });
  });
});
