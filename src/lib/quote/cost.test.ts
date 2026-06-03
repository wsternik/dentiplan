import { describe, expect, it } from "vitest";

import { ANESTHESIA_FEE_SCHEDULE } from "@/lib/pricing";
import type { GeneralItem, PricelistItemRef, QuoteContent, ToothEntry, ToothStatus } from "@/types";

import { computeQuoteTotals } from "./cost";

// ---------------------------------------------------------------------------
// Fixture builders — keep the worked examples readable without re-stating every
// schema-defaulted field on each tooth/item.
// ---------------------------------------------------------------------------

let idSeq = 0;
const nextId = () => `item-${(idSeq += 1)}`;

function fixed(amount: number, opts: { localAnesthesia?: boolean } = {}): PricelistItemRef {
  return {
    id: nextId(),
    name: `fixed-${amount}`,
    price: { kind: "fixed", amount },
    localAnesthesia: opts.localAnesthesia ?? false,
  };
}
function range(min: number, max: number): PricelistItemRef {
  return { id: nextId(), name: `range-${min}-${max}`, price: { kind: "range", min, max }, localAnesthesia: false };
}
function modifier(amount: number): PricelistItemRef {
  return { id: nextId(), name: `modifier-${amount}`, price: { kind: "modifier", amount }, localAnesthesia: false };
}
function fromPrice(amount: number): PricelistItemRef {
  return { id: nextId(), name: `from-${amount}`, price: { kind: "from", amount }, localAnesthesia: false };
}

interface ToothPartial {
  number: number;
  status?: ToothStatus;
  visitNumber?: number | null;
  items?: PricelistItemRef[];
}
function tooth(p: ToothPartial): ToothEntry {
  return {
    number: p.number,
    treatmentType: null,
    urgency: null,
    status: p.status ?? "in-plan",
    note: "",
    pricelistItems: p.items ?? [],
    visitNumber: p.visitNumber ?? null,
  };
}

function general(item: PricelistItemRef, visitNumber: number | null = null): GeneralItem {
  return { id: nextId(), item, visitNumber };
}

function content(p: Partial<QuoteContent> = {}): QuoteContent {
  return { teeth: p.teeth ?? [], visits: p.visits ?? [], generalItems: p.generalItems ?? [] };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("computeQuoteTotals — standard plan", () => {
  it("sums fixed-only items into a point grand total", () => {
    const totals = computeQuoteTotals(
      content({
        teeth: [tooth({ number: 16, items: [fixed(800)] }), tooth({ number: 26, items: [fixed(200)] })],
      }),
    );
    expect(totals.standard?.grandTotal).toEqual({ min: 1000, max: 1000 });
  });

  it("sums ranges as ranges across multiple teeth and visits (FR-026)", () => {
    const totals = computeQuoteTotals(
      content({
        teeth: [
          tooth({ number: 16, visitNumber: 1, items: [range(250, 400)] }),
          tooth({ number: 26, visitNumber: 2, items: [range(250, 400), fixed(100)] }),
        ],
      }),
    );
    // mins add, maxes add: (250+250+100, 400+400+100)
    expect(totals.standard?.grandTotal).toEqual({ min: 600, max: 900 });
  });

  it("treats a modifier as a per-tooth add-on, not a standalone line (FR add-on)", () => {
    const totals = computeQuoteTotals(content({ teeth: [tooth({ number: 16, items: [fixed(800), modifier(500)] })] }));
    expect(totals.standard?.grandTotal).toEqual({ min: 1300, max: 1300 });
  });

  it("treats a `from` price as a fixed lower bound (reserved kind)", () => {
    const totals = computeQuoteTotals(content({ teeth: [tooth({ number: 16, items: [fromPrice(900)] })] }));
    expect(totals.standard?.grandTotal).toEqual({ min: 900, max: 900 });
  });

  it("excludes uncertain and out-of-current-plan teeth from the standard total (FR-040)", () => {
    const totals = computeQuoteTotals(
      content({
        teeth: [
          tooth({ number: 16, status: "in-plan", items: [fixed(800)] }),
          tooth({ number: 26, status: "uncertain", items: [fixed(9999)] }),
          tooth({ number: 36, status: "out-of-current-plan", items: [fixed(9999)] }),
        ],
      }),
    );
    expect(totals.standard?.grandTotal).toEqual({ min: 800, max: 800 });
  });

  it("includes general items in the standard total", () => {
    const totals = computeQuoteTotals(
      content({ teeth: [tooth({ number: 16, items: [fixed(800)] })], generalItems: [general(fixed(300))] }),
    );
    expect(totals.standard?.grandTotal).toEqual({ min: 1100, max: 1100 });
  });

  it("produces per-visit subtotals that aggregate to the grand total (FR-032)", () => {
    const totals = computeQuoteTotals(
      content({
        teeth: [
          tooth({
            number: 16,
            visitNumber: 1,
            items: [fixed(800), modifier(500), fixed(50, { localAnesthesia: true })],
          }),
          tooth({ number: 26, visitNumber: 2, items: [range(250, 400)] }),
        ],
        generalItems: [general(fixed(300), 1)],
      }),
    );
    expect(totals.standard?.perVisit).toEqual([
      { visitNumber: 1, cost: { min: 1650, max: 1650 } }, // 800 + 500 + 50 + 300
      { visitNumber: 2, cost: { min: 250, max: 400 } },
    ]);
    expect(totals.standard?.grandTotal).toEqual({ min: 1900, max: 2050 });
  });

  it("keeps items with no visit assignment out of perVisit but in the grand total", () => {
    const totals = computeQuoteTotals(
      content({
        teeth: [
          tooth({ number: 16, visitNumber: 1, items: [fixed(800)] }),
          tooth({ number: 26, visitNumber: null, items: [fixed(200)] }),
        ],
      }),
    );
    expect(totals.standard?.perVisit).toEqual([{ visitNumber: 1, cost: { min: 800, max: 800 } }]);
    expect(totals.standard?.grandTotal).toEqual({ min: 1000, max: 1000 });
  });
});

describe("computeQuoteTotals — anesthesia plan", () => {
  it("auto-skips localAnesthesia items from the anesthesia total (FR-041)", () => {
    const totals = computeQuoteTotals(
      content({ teeth: [tooth({ number: 16, items: [fixed(800), fixed(50, { localAnesthesia: true })] })] }),
    );
    // permanent tooth → base 2000; treatment post-skip = 800; total = 2800
    expect(totals.anesthesia?.fee).toBe(2000);
    expect(totals.anesthesia?.total).toEqual({ min: 2800, max: 2800 });
  });

  it("uses the milk base fee when every in-plan tooth is milk (FR-042)", () => {
    const totals = computeQuoteTotals(
      content({ teeth: [tooth({ number: 54, items: [fixed(150)] }), tooth({ number: 64, items: [fixed(150)] })] }),
    );
    expect(totals.anesthesia?.fee).toBe(1400);
    expect(totals.anesthesia?.total).toEqual({ min: 1700, max: 1700 }); // 300 + 1400
  });

  it("uses the permanent base fee when at least one in-plan tooth is permanent (FR-042)", () => {
    const totals = computeQuoteTotals(
      content({ teeth: [tooth({ number: 54, items: [fixed(150)] }), tooth({ number: 16, items: [fixed(150)] })] }),
    );
    expect(totals.anesthesia?.fee).toBe(2000);
    expect(totals.anesthesia?.total).toEqual({ min: 2300, max: 2300 }); // 300 + 2000
  });

  it("adds no per-tooth surcharge at exactly the included-teeth boundary (5 teeth, FR-043)", () => {
    const teeth = [51, 52, 53, 54, 55].map((number) => tooth({ number }));
    const totals = computeQuoteTotals(content({ teeth }));
    expect(totals.anesthesia?.fee).toBe(1400); // baseMilk, 0 extra
  });

  it("adds +100 per tooth beyond the included count (6 teeth, FR-043)", () => {
    const teeth = [51, 52, 53, 54, 55, 61].map((number) => tooth({ number }));
    const totals = computeQuoteTotals(content({ teeth }));
    expect(totals.anesthesia?.fee).toBe(1500); // baseMilk + 1 * 100
  });

  it("combines permanent base with the per-tooth surcharge (6 teeth, one permanent)", () => {
    const teeth = [51, 52, 53, 54, 55, 16].map((number) => tooth({ number }));
    const totals = computeQuoteTotals(content({ teeth }));
    expect(totals.anesthesia?.fee).toBe(2100); // basePermanent 2000 + 1 * 100
  });

  it("excludes uncertain / out-of-current-plan teeth from the anesthesia count and base (FR-044)", () => {
    const teeth = [
      ...[51, 52, 53, 54, 55, 61].map((number) => tooth({ number })), // 6 milk in-plan
      tooth({ number: 16, status: "uncertain" }), // permanent, must NOT bump base or count
      tooth({ number: 26, status: "out-of-current-plan" }), // must NOT bump base or count
    ];
    const totals = computeQuoteTotals(content({ teeth }));
    // count = 6 in-plan milk only → baseMilk 1400 + 1 extra tooth = 1500
    expect(totals.anesthesia?.fee).toBe(1500);
  });
});

describe("computeQuoteTotals — edge cases", () => {
  it("returns zeroed standard totals and the milk fee floor for an empty quote", () => {
    const totals = computeQuoteTotals(content());
    expect(totals.standard?.perVisit).toEqual([]);
    expect(totals.standard?.grandTotal).toEqual({ min: 0, max: 0 });
    expect(totals.anesthesia?.fee).toBe(1400);
    expect(totals.anesthesia?.total).toEqual({ min: 1400, max: 1400 });
  });

  it("yields the milk fee floor when no tooth is anesthesia-eligible (all out-of-plan)", () => {
    const totals = computeQuoteTotals(
      content({
        teeth: [
          tooth({ number: 16, status: "out-of-current-plan", items: [fixed(800)] }),
          tooth({ number: 26, status: "uncertain", items: [fixed(800)] }),
        ],
        generalItems: [general(fixed(300))],
      }),
    );
    // no in-plan tooth → baseMilk 1400; treatment skipped; general 300 still counts
    expect(totals.anesthesia?.fee).toBe(1400);
    expect(totals.anesthesia?.total).toEqual({ min: 1700, max: 1700 });
    expect(totals.standard?.grandTotal).toEqual({ min: 300, max: 300 });
  });

  it("matches the seed fee schedule constants used by the engine", () => {
    // Pins the worked-example numbers to F-02's load-time-validated source.
    expect(ANESTHESIA_FEE_SCHEDULE).toMatchObject({
      baseMilk: 1400,
      basePermanent: 2000,
      perExtraTooth: 100,
      includedTeeth: 5,
    });
  });
});
