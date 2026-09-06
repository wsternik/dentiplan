// FDI tooth number → drawing position (S-06).
//
// Pure, no DOM, no IO. This is the file that owns the FDI meaning of the
// vendored geometry: `paths.ts` holds four anonymous transforms in draw order
// and eight anonymous shapes, and nothing in it knows what a quadrant is.
//
// It is also the file that corrects the upstream defect. `react-odontogram`
// 0.5.6 assigns its `third` quadrant — the one its own `convertFDIToNotation`
// maps to FDI 3 — to the image's lower-left slot, and `fourth` (FDI 4) to the
// lower-right. FDI quadrant 3 is the patient's lower LEFT, which faces the
// viewer's RIGHT, so the library's two lower quadrants are mirrored. Because
// the fix is a mapping we own rather than a patch to copied bytes, upgrading
// or re-copying the geometry can never silently reintroduce it.

import { isValidToothNumber } from "@/lib/quote/tooth-name";
import { dentitionForTooth, type Dentition } from "@/types";

import { TOOTH_SHAPES } from "./paths";

/** Index into `SLOT_TRANSFORMS`, in draw order. */
export type Slot = 0 | 1 | 2 | 3;

/**
 * Slot for an FDI quadrant digit (1–8).
 *
 * Written as an explicit table with the anatomy spelled out, never as
 * arithmetic: the obvious `quadrant - 1` version is exactly the version the
 * library shipped, and it is wrong. Milk quadrants 5–8 ride on their permanent
 * counterparts 1–4.
 *
 *   FDI 1  patient's upper right → viewer's upper left   → slot 0
 *   FDI 2  patient's upper left  → viewer's upper right  → slot 1
 *   FDI 3  patient's lower left  → viewer's lower RIGHT  → slot 3   ← the fix
 *   FDI 4  patient's lower right → viewer's lower LEFT   → slot 2   ← the fix
 */
const SLOT_BY_QUADRANT: Record<number, Slot | undefined> = {
  1: 0,
  2: 1,
  3: 3,
  4: 2,
  5: 0, // milk upper right
  6: 1, // milk upper left
  7: 3, // milk lower left
  8: 2, // milk lower right
};

export function slotForQuadrant(quadrant: number): Slot {
  const slot = SLOT_BY_QUADRANT[quadrant];
  if (slot === undefined) throw new RangeError(`Not an FDI quadrant: ${quadrant}`);
  return slot;
}

/** One drawable position on the chart. */
export interface ChartPosition {
  /** FDI tooth number. */
  number: number;
  /** Which of the four quadrant transforms draws it. */
  slot: Slot;
  /** Index into `TOOTH_SHAPES`. */
  shapeIndex: number;
  dentition: Dentition;
  /** Uniform scale about the shape's own centre; < 1 for a milk tooth. */
  scale: number;
  /**
   * Steps to displace this tooth outward along the arch, away from the midline.
   * Zero for every tooth that has its slot position to itself. It is non-zero
   * only when a milk tooth and its permanent successor are both in the quote
   * (exfoliation) — they share one position, and drawing them on top of each
   * other would hide a tooth that is in the plan.
   */
  arcOffset: number;
}

/** A milk tooth is drawn at 85% so that it reads as smaller without leaving a gap. */
const MILK_SCALE = 0.85;

/**
 * Every drawable position for a quote, not only the teeth it contains: the
 * chart draws a whole mouth, so an unplanned tooth still needs somewhere to be.
 *
 * The 32 permanent positions are always present. A milk tooth is added only
 * when the quote holds it, on its permanent successor's slot and shape at
 * reduced scale — 51→11 … 55→15.
 *
 * **This is an approximation, and it is named as one here, in `research.md`, and
 * in the chart's legend.** The vendored paths carry absolute coordinates, so a
 * shape is also its place on the arch; there is no separate milk geometry, and
 * a milk molar is therefore drawn as a smaller version of the premolar that
 * replaces it rather than as a molar silhouette. It marks the right tooth in
 * the right place; it is not anatomical fidelity.
 */
export function chartPositions(teeth: readonly { number: number }[]): ChartPosition[] {
  const present = new Set(teeth.map((tooth) => tooth.number).filter(isValidToothNumber));

  const positions: ChartPosition[] = [];
  for (const quadrant of [1, 2, 3, 4]) {
    for (const [shapeIndex, shape] of TOOTH_SHAPES.entries()) {
      const position = shape.position;
      const number = quadrant * 10 + position;
      // A milk tooth occupies the crown position; its successor steps outward.
      const milkNumber = position <= 5 ? number + 40 : null;
      const sharesSlot = milkNumber !== null && present.has(milkNumber) && present.has(number);

      if (milkNumber !== null && present.has(milkNumber)) {
        positions.push({
          number: milkNumber,
          slot: slotForQuadrant(quadrant + 4),
          shapeIndex,
          dentition: dentitionForTooth(milkNumber),
          scale: MILK_SCALE,
          arcOffset: 0,
        });
      }
      positions.push({
        number,
        slot: slotForQuadrant(quadrant),
        shapeIndex,
        dentition: dentitionForTooth(number),
        scale: 1,
        arcOffset: sharesSlot ? 1 : 0,
      });
    }
  }
  return positions;
}
