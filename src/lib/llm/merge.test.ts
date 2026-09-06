// Risk #7, the half that happens after the server has done its job: the prefill
// is additive, so the merge must never overwrite what the dentystka typed, never
// leave two rows for one tooth (the editor keys rows by number), and never point
// a prefilled tooth at the wrong visit.
//
// Both defects the implementation review found lived here, in a component, where
// the only way to see them was to look. They are stated as tests now.

import { describe, expect, it } from "vitest";

import { resolvePricelistItem } from "@/lib/pricing";
import { computeQuoteTotals } from "@/lib/quote/cost";
import type { GeneralItem, ToothEntry, Visit } from "@/types";

import { mergePrefill, type WorkingTree } from "./merge";
import type { PrefillResult } from "./schema";

const MOLAR_ROOT_CANAL = "leczenie-kanalowe:leczenie-kanalowe-trzonowca";
const HYGIENE = "profilaktyka:higienizacja";

function tooth(number: number, over: Partial<ToothEntry> = {}): ToothEntry {
  return {
    number,
    treatmentType: null,
    urgency: null,
    status: "in-plan",
    note: "",
    pricelistItems: [],
    visitNumber: null,
    ...over,
  };
}

/** A general item as the server proposes it: a resolved ref plus its visit. */
function general(id: string, visitNumber: number | null = null) {
  return { item: resolvePricelistItem(id), visitNumber };
}

function emptyTree(over: Partial<WorkingTree> = {}): WorkingTree {
  return { teeth: [], visits: [], generalItems: [], ...over };
}

function prefill(over: Partial<PrefillResult["content"]> = {}, warnings: string[] = []): PrefillResult {
  return { content: { teeth: [], visits: [], generalItems: [], ...over }, warnings };
}

describe("mergePrefill", () => {
  it("adds the prefilled teeth and keeps the tree sorted", () => {
    const merged = mergePrefill(emptyTree({ teeth: [tooth(34)] }), prefill({ teeth: [tooth(16), tooth(37)] }), 0);

    expect(merged.teeth.map((t) => t.number)).toEqual([16, 34, 37]);
    expect(merged.warnings).toEqual([]);
  });

  it("never overwrites a tooth she already filled in, and says which it skipped", () => {
    const hers: ToothEntry = tooth(16, {
      treatmentType: "extraction",
      urgency: "urgent",
      pricelistItems: [resolvePricelistItem(MOLAR_ROOT_CANAL)],
    });

    const merged = mergePrefill(
      emptyTree({ teeth: [hers] }),
      prefill({ teeth: [tooth(16, { treatmentType: "filling" }), tooth(17)] }),
      0,
    );

    expect(merged.teeth.map((t) => t.number)).toEqual([16, 17]);
    // Hers, untouched — not merged, not replaced.
    expect(merged.teeth.find((t) => t.number === 16)).toEqual(hers);
    expect(merged.warnings).toContain("Ząb 16 był już w formularzu — pominięto propozycję z notatki.");
  });

  it("remaps prefilled visit numbers onto the visits they actually became", () => {
    // She already has one visit; the note proposes two more. The note's "visit 1"
    // is the merged tree's visit 2 — using the model's number unchanged would
    // silently move a tooth into a visit she planned for something else.
    const existingVisit: Visit = { number: 1, label: "Higienizacja" };

    const merged = mergePrefill(
      emptyTree({ visits: [existingVisit] }),
      prefill({
        teeth: [tooth(16, { visitNumber: 1 }), tooth(36, { visitNumber: 2 }), tooth(32, { visitNumber: null })],
        visits: [
          { number: 1, label: "Wypełnienia" },
          { number: 2, label: "Kanałowe" },
        ],
      }),
      0,
    );

    expect(merged.visits).toEqual([
      { number: 1, label: "Higienizacja" },
      { number: 2, label: "Wypełnienia" },
      { number: 3, label: "Kanałowe" },
    ]);
    expect(merged.teeth.find((t) => t.number === 16)?.visitNumber).toBe(2);
    expect(merged.teeth.find((t) => t.number === 36)?.visitNumber).toBe(3);
    expect(merged.teeth.find((t) => t.number === 32)?.visitNumber).toBeNull();
  });

  it("remaps by the visit's own number, not by its position — the model may not count from 1", () => {
    // Found by the pipeline's review agent. Nothing in the schema or the prompt
    // makes the model number its visits 1, 2, 3 in order; it might return 2 and
    // 5. Positional arithmetic (`visitNumber + offset`) happens to be right for
    // 1, 2, 3 and silently wrong for anything else — a tooth attached to a visit
    // that does not exist, with no warning. Every other test here uses 1, 2, 3,
    // which is exactly why this one does not.
    const merged = mergePrefill(
      emptyTree(),
      prefill({
        teeth: [tooth(16, { visitNumber: 2 }), tooth(36, { visitNumber: 5 })],
        visits: [
          { number: 2, label: "Pierwsza" },
          { number: 5, label: "Druga" },
        ],
      }),
      0,
    );

    expect(merged.visits).toEqual([
      { number: 1, label: "Pierwsza" },
      { number: 2, label: "Druga" },
    ]);
    expect(merged.teeth.find((t) => t.number === 16)?.visitNumber).toBe(1);
    expect(merged.teeth.find((t) => t.number === 36)?.visitNumber).toBe(2);
  });

  it("drops a visit reference the prefill's own visit list does not contain", () => {
    const merged = mergePrefill(
      emptyTree(),
      prefill({ teeth: [tooth(16, { visitNumber: 9 })], visits: [{ number: 1, label: "Jedyna" }] }),
      0,
    );

    expect(merged.teeth[0].visitNumber).toBeNull();
    expect(merged.warnings.some((w) => w.includes("16"))).toBe(true);
  });

  it("does not add a general item she already has, and mints ids past the counter", () => {
    const existing: GeneralItem = { id: "g-4", item: resolvePricelistItem(HYGIENE), visitNumber: null };

    const merged = mergePrefill(
      emptyTree({ generalItems: [existing] }),
      prefill({ generalItems: [general(HYGIENE), general("profilaktyka:rtg-pantomogram")] }),
      4,
    );

    expect(merged.generalItems.map((g) => g.id)).toEqual(["g-4", "g-5"]);
    expect(merged.generalItems.map((g) => g.item.id)).toEqual([HYGIENE, "profilaktyka:rtg-pantomogram"]);
    expect(merged.generalIdSeed).toBe(5);
    expect(merged.warnings.some((w) => w.includes("pozycjach ogólnych"))).toBe(true);
  });

  it("FR-032: a general item's visit follows the same renumbering its teeth do", () => {
    // She already planned a visit, so the prefill's visit 1 is the merged tree's
    // visit 2 — and the hygiene the model attached to it has to move with it.
    // Left on the model's number it would price the visit she planned herself.
    const merged = mergePrefill(
      emptyTree({ visits: [{ number: 1, label: "Konsultacja" }] }),
      prefill({
        teeth: [tooth(16, { visitNumber: 1 })],
        visits: [{ number: 1, label: "Leczenie zachowawcze" }],
        generalItems: [general(HYGIENE, 1)],
      }),
      0,
    );

    expect(merged.teeth.find((t) => t.number === 16)?.visitNumber).toBe(2);
    expect(merged.generalItems).toEqual([{ id: "g-1", item: resolvePricelistItem(HYGIENE), visitNumber: 2 }]);
    expect(merged.warnings).toEqual([]);
  });

  it("FR-032: a general item pointing at a visit the prefill never declared is kept without one, and named", () => {
    const merged = mergePrefill(
      emptyTree(),
      prefill({ visits: [{ number: 1, label: "Jedyna" }], generalItems: [general(HYGIENE, 9)] }),
      0,
    );

    // Kept, not dropped: she is going to be billed for it either way, and the
    // dropdown is one click. The same treatment tooth 16 gets two tests up.
    expect(merged.generalItems.map((g) => g.item.id)).toEqual([HYGIENE]);
    expect(merged.generalItems[0].visitNumber).toBeNull();
    expect(merged.warnings.some((w) => w.includes("Higienizacja"))).toBe(true);
  });

  it("FR-032: a prefilled general item's price lands in its visit's partial cost", () => {
    // The whole point of the phase, asserted through the engine that computes what
    // she reads: a visit's partial total is the whole visit, not just its teeth.
    const merged = mergePrefill(
      emptyTree(),
      prefill({
        teeth: [tooth(16, { visitNumber: 1, pricelistItems: [resolvePricelistItem(MOLAR_ROOT_CANAL)] })],
        visits: [{ number: 1, label: "Leczenie kanałowe" }],
        generalItems: [general(HYGIENE, 1)],
      }),
      0,
    );

    // From the seed: a molar root canal is 1200 zł and higienizacja is 400–450 zł.
    // Before this phase the prefilled hygiene had no visit, so visit 1 read
    // 1200 — a partial cost that was wrong by a whole item and looked complete.
    expect(computeQuoteTotals(merged).standard?.perVisit).toEqual([{ visitNumber: 1, cost: { min: 1600, max: 1650 } }]);
  });

  it("carries the server's warnings through alongside its own", () => {
    const merged = mergePrefill(
      emptyTree({ teeth: [tooth(16)] }),
      prefill({ teeth: [tooth(16)] }, ["Pominięto ząb 99 — numer spoza zakresu FDI."]),
      0,
    );

    expect(merged.warnings).toEqual([
      "Pominięto ząb 99 — numer spoza zakresu FDI.",
      "Ząb 16 był już w formularzu — pominięto propozycję z notatki.",
    ]);
  });
});
