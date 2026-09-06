import { describe, expect, it } from "vitest";

import { isValidToothNumber } from "@/lib/quote/tooth-name";

import { chartPositions, slotForQuadrant } from "./layout";

describe("slotForQuadrant — corrects react-odontogram's swapped lower quadrants", () => {
  it("maps FDI quadrant 1 (patient's upper right) to the image's upper-left slot", () => {
    expect(slotForQuadrant(1)).toBe(0);
  });

  it("maps FDI quadrant 2 (patient's upper left) to the image's upper-right slot", () => {
    expect(slotForQuadrant(2)).toBe(1);
  });

  // The upstream defect: react-odontogram 0.5.6 draws its `third` quadrant
  // (which its own convertFDIToNotation maps to FDI 3 / lower left) into the
  // image's lower-LEFT slot. FDI quadrant 3 is the patient's lower left, which
  // faces the viewer's right, so the library's two lower quadrants are mirrored.
  it("maps FDI quadrant 3 (patient's lower left) to the image's lower-RIGHT slot, where the library puts quadrant 4", () => {
    expect(slotForQuadrant(3)).toBe(3);
  });

  it("maps FDI quadrant 4 (patient's lower right) to the image's lower-LEFT slot, where the library puts quadrant 3", () => {
    expect(slotForQuadrant(4)).toBe(2);
  });

  it("maps each milk quadrant 5–8 onto the slot of its permanent counterpart 1–4", () => {
    expect([5, 6, 7, 8].map(slotForQuadrant)).toEqual([0, 1, 3, 2]);
  });
});

describe("chartPositions", () => {
  const permanent = [1, 2, 3, 4].flatMap((q) => [1, 2, 3, 4, 5, 6, 7, 8].map((p) => q * 10 + p));
  const milk = [5, 6, 7, 8].flatMap((q) => [1, 2, 3, 4, 5].map((p) => q * 10 + p));

  it("draws every permanent tooth even when the quote holds none", () => {
    const positions = chartPositions([]);
    expect(positions.map((p) => p.number).sort((a, b) => a - b)).toEqual(permanent);
  });

  it("gives a position to every number `isValidToothNumber` accepts", () => {
    const positions = chartPositions(milk.map((number) => ({ number })));
    const drawn = new Set(positions.map((p) => p.number));
    for (const number of [...permanent, ...milk]) {
      expect(isValidToothNumber(number), `${number} is valid FDI`).toBe(true);
      expect(drawn.has(number), `${number} is drawn`).toBe(true);
    }
  });

  it("lands each milk tooth on its permanent successor's slot and shape, at reduced scale", () => {
    const positions = chartPositions([{ number: 55 }]);
    const milkTooth = positions.find((p) => p.number === 55);
    const successor = positions.find((p) => p.number === 15);
    expect(milkTooth).toMatchObject({
      slot: successor?.slot,
      shapeIndex: successor?.shapeIndex,
      dentition: "milk",
    });
    expect(milkTooth?.scale).toBeLessThan(1);
    expect(successor?.scale).toBe(1);
  });

  it("draws both a milk tooth and its permanent successor when a quote holds both (exfoliation)", () => {
    const positions = chartPositions([{ number: 55 }, { number: 15 }]);
    const shared = positions.filter((p) => p.number === 55 || p.number === 15);
    expect(shared).toHaveLength(2);
    expect(new Set(shared.map((p) => p.slot)).size).toBe(1);
    // Same slot, so one of the two is displaced outward along the arch;
    // otherwise the pair would draw on top of each other and one tooth in the
    // plan would be invisible.
    expect(new Set(shared.map((p) => p.arcOffset)).size).toBe(2);
  });

  it("does not displace a permanent tooth whose milk predecessor is absent", () => {
    expect(chartPositions([{ number: 15 }]).find((p) => p.number === 15)?.arcOffset).toBe(0);
  });

  it("ignores tooth numbers that are not valid FDI codes", () => {
    expect(chartPositions([{ number: 99 }]).some((p) => p.number === 99)).toBe(false);
  });
});
