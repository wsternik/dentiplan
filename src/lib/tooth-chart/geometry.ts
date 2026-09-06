// Where a tooth's shape is drawn (S-06).
//
// Pure, no DOM. `layout.ts` decides *which* slot and *how big*; this file turns
// that decision into the one SVG `transform` string the component puts on a
// tooth's group. It exists because the vendored paths carry **absolute**
// coordinates — a shape is also its place on the arch — so every adjustment the
// chart makes (a milk tooth's 85%, a shared slot's separation) has to be
// expressed as a transform about a point we compute here rather than as a
// different path.
//
// The centres below are the bounding-box centres of `TOOTH_SHAPES`, computed
// from the path data rather than copied from upstream (the library has no such
// table). They are checked in as constants because they are properties of frozen
// geometry: a parser at runtime would spend work on an answer that cannot change.

import type { ChartPosition } from "./layout";
import { CHART_VIEWBOX } from "./paths";

/**
 * Bounding-box centre of each entry in `TOOTH_SHAPES`, in the same order
 * (FDI position 1 → 8). Units are viewBox units of the untransformed
 * upper-left slot.
 */
const SHAPE_CENTERS: readonly (readonly [number, number])[] = [
  [179.1, 30.9], // 1 central incisor
  [132.0, 34.4], // 2 lateral incisor
  [100.2, 56.2], // 3 canine
  [78.7, 87.6], // 4 first premolar
  [60.8, 121.0], // 5 second premolar
  [41.6, 170.4], // 6 first molar
  [30.2, 230.7], // 7 second molar
  [32.3, 290.1], // 8 third molar
];

const [, , VIEWBOX_WIDTH, VIEWBOX_HEIGHT] = CHART_VIEWBOX.split(" ").map(Number);

/**
 * The middle of the mouth. All four slots are mirrors of the upper-left one
 * about this point, so "away from the arch centre" is the same direction in
 * every slot's own coordinate space — which is why the offset can be applied
 * before the slot transform and still come out pointing outward.
 */
const ARCH_CENTER: readonly [number, number] = [VIEWBOX_WIDTH / 2, VIEWBOX_HEIGHT / 2];

/**
 * How far one `arcOffset` step displaces a tooth, in viewBox units. Teeth are
 * roughly 50 units across; 26 clears the crown position without reaching the
 * neighbouring tooth's shape.
 */
const ARC_OFFSET_STEP = 26;

/**
 * Room added around the vendored viewBox for the things it does not account
 * for: stroke width at the edges, and the outward displacement a shared slot
 * applies to a tooth that already sits at the top of the arch (tooth 11's shape
 * starts at y ≈ 0.9, so an un-padded box would clip it away).
 */
const CHART_PADDING = 30;

/** The vendored viewBox with room for strokes and displaced teeth. */
export const CHART_VIEWBOX_PADDED = [
  -CHART_PADDING,
  -CHART_PADDING,
  VIEWBOX_WIDTH + CHART_PADDING * 2,
  VIEWBOX_HEIGHT + CHART_PADDING * 2,
].join(" ");

/** Unit vector from the arch centre to a shape's centre — "outward". */
function outwardFrom(center: readonly [number, number]): [number, number] {
  const dx = center[0] - ARCH_CENTER[0];
  const dy = center[1] - ARCH_CENTER[1];
  const length = Math.hypot(dx, dy);
  return length === 0 ? [0, 0] : [dx / length, dy / length];
}

/**
 * The `transform` for one tooth, applied inside its slot's group.
 *
 * Two adjustments, both about the shape's own centre so the tooth stays on its
 * place on the arch:
 *
 *   - **scale** — a milk tooth is drawn at `position.scale` (0.85), which reads
 *     as smaller without leaving a hole where a tooth should be.
 *   - **arcOffset** — displaces the tooth away from the arch centre. It is
 *     non-zero only when a milk tooth and its permanent successor are both in
 *     the quote, which is the case the mixed-dentition decision exists to serve.
 *     Without it the two share one set of coordinates and the tooth drawn first
 *     disappears under the other — a tooth that is in the plan, invisible.
 */
export function toothTransform(position: ChartPosition): string {
  const center = SHAPE_CENTERS[position.shapeIndex];
  const parts: string[] = [];
  if (position.arcOffset !== 0) {
    const [ux, uy] = outwardFrom(center);
    const distance = position.arcOffset * ARC_OFFSET_STEP;
    parts.push(`translate(${round(ux * distance)} ${round(uy * distance)})`);
  }
  if (position.scale !== 1) {
    parts.push(
      `translate(${center[0]} ${center[1]})`,
      `scale(${position.scale})`,
      `translate(${-center[0]} ${-center[1]})`,
    );
  }
  return parts.join(" ");
}

/**
 * Where a tooth ends up in the chart's coordinate space, after both its own
 * transform and its slot's mirror.
 *
 * The component does not need this — the browser composes the same transforms —
 * but a test does. `slotForQuadrant` proves which slot a quadrant gets; only
 * this proves that the slot's mirror puts it in the half of the drawing the
 * patient is looking at, which is the whole subject of the upstream defect.
 */
export function toothCenter(position: ChartPosition): [number, number] {
  const [cx, cy] = SHAPE_CENTERS[position.shapeIndex];
  const [ux, uy] = position.arcOffset === 0 ? [0, 0] : outwardFrom(SHAPE_CENTERS[position.shapeIndex]);
  const distance = position.arcOffset * ARC_OFFSET_STEP;
  // The scale is about the shape's own centre, so it leaves the centre where it
  // is; only the displacement moves it.
  const x = cx + ux * distance;
  const y = cy + uy * distance;
  // Slot 1 and 3 mirror x about the middle; slots 2 and 3 mirror y.
  const mirrorX = position.slot === 1 || position.slot === 3;
  const mirrorY = position.slot === 2 || position.slot === 3;
  return [mirrorX ? VIEWBOX_WIDTH - x : x, mirrorY ? VIEWBOX_HEIGHT - y : y];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
