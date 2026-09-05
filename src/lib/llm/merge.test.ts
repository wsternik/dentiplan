// Risk #7, the half that happens after the server has done its job: the prefill
// is additive, so the merge must never overwrite what the dentystka typed, never
// leave two rows for one tooth (the editor keys rows by number), and never point
// a prefilled tooth at the wrong visit.
//
// Both defects the implementation review found lived here, in a component, where
// the only way to see them was to look. They are stated as tests now.

import { describe, expect, it } from "vitest";

import { resolvePricelistItem } from "@/lib/pricing";
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

  it("does not add a general item she already has, and mints ids past the counter", () => {
    const existing: GeneralItem = { id: "g-4", item: resolvePricelistItem(HYGIENE), visitNumber: null };

    const merged = mergePrefill(
      emptyTree({ generalItems: [existing] }),
      prefill({ generalItems: [resolvePricelistItem(HYGIENE), resolvePricelistItem("profilaktyka:rtg-pantomogram")] }),
      4,
    );

    expect(merged.generalItems.map((g) => g.id)).toEqual(["g-4", "g-5"]);
    expect(merged.generalItems.map((g) => g.item.id)).toEqual([HYGIENE, "profilaktyka:rtg-pantomogram"]);
    expect(merged.generalIdSeed).toBe(5);
    expect(merged.warnings.some((w) => w.includes("pozycjach ogólnych"))).toBe(true);
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
