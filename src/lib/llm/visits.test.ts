// Risk #11 (`context/foundation/test-plan.md`): "a split that looks sensible and
// is medically wrong arrives pre-filled and gets approved, because nothing
// distinguishes what the note said from what the model supplied."
//
// This file covers the half of that risk the code owns outright: the order the
// visits come back in, and the words they are named with. Both used to be the
// model's to decide. A test here is a statement about our rules, not about a
// model's mood — which is why these run on constructed input rather than on a
// recorded answer.

import { describe, expect, it } from "vitest";

import type { ToothEntry, Visit } from "@/types";

import { MAX_PROPOSED_VISITS, VISIT_LABELS, orderVisits, visitLabel } from "./visits";

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

/** The model's numbering, before ours replaces it. Labels are never its business. */
function visit(number: number): Visit {
  return { number, label: "" };
}

describe("visitLabel", () => {
  it("names an urgent visit urgent, whatever is being done at it", () => {
    // Urgency deliberately outranks treatment type: what makes her schedule this
    // visit first is that it hurts, not that it happens to be a root canal.
    const label = visitLabel([
      tooth(36, { treatmentType: "root-canal", urgency: "urgent" }),
      tooth(37, { treatmentType: "filling", urgency: "moderate" }),
    ]);

    expect(label).toBe("Leczenie pilne");
  });

  it("names a visit from its treatment when nothing at it is urgent", () => {
    const rootCanals = visitLabel([
      tooth(36, { treatmentType: "root-canal", urgency: "moderate" }),
      tooth(37, { treatmentType: "root-canal" }),
    ]);
    const withExtraction = visitLabel([
      tooth(38, { treatmentType: "extraction" }),
      tooth(16, { treatmentType: "filling" }),
    ]);
    const conservative = visitLabel([tooth(16, { treatmentType: "filling" }), tooth(17)]);

    expect(rootCanals).toBe("Leczenie kanałowe");
    expect(withExtraction).toBe("Ekstrakcje");
    expect(conservative).toBe("Leczenie zachowawcze");
  });

  it("leaves a visit with no teeth unnamed, so she sees the placeholder rather than a guess", () => {
    expect(visitLabel([])).toBe("");
  });

  it("only ever returns a member of the closed dictionary", () => {
    const labels = [
      visitLabel([tooth(36, { urgency: "urgent" })]),
      visitLabel([tooth(36, { treatmentType: "root-canal" })]),
      visitLabel([tooth(38, { treatmentType: "extraction" })]),
      visitLabel([tooth(16, { treatmentType: "caries-removal" })]),
    ];

    for (const label of labels) {
      expect(VISIT_LABELS).toContain(label);
    }
  });
});

describe("orderVisits", () => {
  it("puts the most urgent visit first and takes its teeth with it", () => {
    const result = orderVisits(
      [visit(1), visit(2)],
      [
        tooth(16, { treatmentType: "filling", urgency: "mild", visitNumber: 1 }),
        tooth(36, { treatmentType: "root-canal", urgency: "urgent", visitNumber: 2 }),
      ],
    );

    expect(result.visits).toEqual([
      { number: 1, label: "Leczenie pilne" },
      { number: 2, label: "Leczenie zachowawcze" },
    ]);
    // The urgent tooth is at visit 1 now — and the other tooth moved too, rather
    // than staying behind pointing at a visit that is no longer its own.
    expect(result.teeth.find((t) => t.number === 36)?.visitNumber).toBe(1);
    expect(result.teeth.find((t) => t.number === 16)?.visitNumber).toBe(2);
    expect(result.renumbered).toEqual(
      new Map([
        [2, 1],
        [1, 2],
      ]),
    );
  });

  it("keeps the model's order when two visits are equally urgent", () => {
    const result = orderVisits(
      [visit(7), visit(3)],
      [
        tooth(16, { treatmentType: "filling", urgency: "moderate", visitNumber: 7 }),
        tooth(26, { treatmentType: "filling", urgency: "moderate", visitNumber: 3 }),
      ],
    );

    // A tie is not a licence to reorder: the model grouped these deliberately and
    // we have nothing better to say about which comes first.
    expect(result.renumbered).toEqual(
      new Map([
        [7, 1],
        [3, 2],
      ]),
    );
  });

  it("ranks a visit whose teeth carry no urgency last, behind every urgency", () => {
    const result = orderVisits(
      [visit(1), visit(2)],
      [
        tooth(16, { treatmentType: "filling", visitNumber: 1 }),
        tooth(36, { treatmentType: "filling", urgency: "mild", visitNumber: 2 }),
      ],
    );

    expect(result.renumbered.get(2)).toBe(1);
    expect(result.renumbered.get(1)).toBe(2);
  });

  it("handles an empty answer and a visit nobody was assigned to", () => {
    expect(orderVisits([], [])).toEqual({ visits: [], teeth: [], renumbered: new Map() });

    const empty = orderVisits([visit(4)], [tooth(16)]);
    expect(empty.visits).toEqual([{ number: 1, label: "" }]);
    // A tooth with no visit stays without one; it must not be swept into the sort.
    expect(empty.teeth[0].visitNumber).toBeNull();
  });

  it("exports the ceiling as one number for the prompt and the mapper to share", () => {
    expect(MAX_PROPOSED_VISITS).toBe(5);
  });
});
