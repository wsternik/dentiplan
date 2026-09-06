import { describe, expect, it } from "vitest";

import { CHART_VIEWBOX_PADDED, toothCenter, toothTransform } from "./geometry";
import { chartPositions } from "./layout";
import { CHART_VIEWBOX } from "./paths";

const positionFor = (number: number, teeth: { number: number }[]) => {
  const position = chartPositions(teeth).find((p) => p.number === number);
  if (position === undefined) throw new Error(`no position for ${number}`);
  return position;
};

describe("toothCenter — the quadrant correction, in drawing coordinates", () => {
  // `slotForQuadrant` proves which slot a quadrant is assigned. This proves the
  // slot's mirror then puts the tooth in the half of the picture the viewer is
  // looking at — which is the half of the question the library got wrong.
  const [, , width, height] = CHART_VIEWBOX.split(" ").map(Number);
  const all = chartPositions([]);
  const centerOf = (number: number) => {
    const position = all.find((p) => p.number === number);
    if (position === undefined) throw new Error(`no position for ${number}`);
    return toothCenter(position);
  };

  it.each([
    ["11", 11, "left", "top"],
    ["21", 21, "right", "top"],
    // FDI 3 is the patient's lower LEFT, which faces the viewer's RIGHT.
    ["31", 31, "right", "bottom"],
    ["41", 41, "left", "bottom"],
  ])("draws %s on the viewer's %s, %s", (_name, number, side, jaw) => {
    const [x, y] = centerOf(number);
    expect(side === "left" ? x < width / 2 : x > width / 2).toBe(true);
    expect(jaw === "top" ? y < height / 2 : y > height / 2).toBe(true);
  });

  it("gives every permanent tooth its own place — no two share coordinates", () => {
    const seen = all.map((position) => toothCenter(position).map(Math.round).join(","));
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe("toothTransform", () => {
  it("leaves a tooth that has its slot to itself untransformed", () => {
    expect(toothTransform(positionFor(15, [{ number: 15 }]))).toBe("");
  });

  it("scales a milk tooth about its own centre, so it stays on the arch", () => {
    const transform = toothTransform(positionFor(55, [{ number: 55 }]));
    // translate(cx cy) scale(0.85) translate(-cx -cy) — the two translates are
    // exact negatives, which is what "about its own centre" means.
    const match = /^translate\((\S+) (\S+)\) scale\(0\.85\) translate\((\S+) (\S+)\)$/.exec(transform);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBeCloseTo(-Number(match?.[3]));
    expect(Number(match?.[2])).toBeCloseTo(-Number(match?.[4]));
  });

  it("separates a milk tooth from its successor when the quote holds both", () => {
    // The exfoliation case. Without a displacement the two share one set of
    // absolute coordinates and the one drawn first vanishes under the other.
    const teeth = [{ number: 55 }, { number: 15 }];
    expect(toothTransform(positionFor(55, teeth))).not.toBe(toothTransform(positionFor(15, teeth)));
    expect(toothTransform(positionFor(15, teeth))).toMatch(/^translate\(/);
  });

  it("displaces the successor away from the middle of the mouth, never towards it", () => {
    const teeth = [{ number: 51 }, { number: 11 }];
    const match = /^translate\((\S+) (\S+)\)/.exec(toothTransform(positionFor(11, teeth)));
    // Tooth 11's shape sits above the arch centre in the untransformed slot, so
    // outward is upward: a negative y step.
    expect(Number(match?.[2])).toBeLessThan(0);
  });

  it("pads the viewBox so a displaced tooth is not clipped", () => {
    const [x, y, width, height] = CHART_VIEWBOX_PADDED.split(" ").map(Number);
    const [, , vendoredWidth, vendoredHeight] = CHART_VIEWBOX.split(" ").map(Number);
    expect(x).toBeLessThan(0);
    expect(y).toBeLessThan(0);
    expect(width).toBeGreaterThan(vendoredWidth);
    expect(height).toBeGreaterThan(vendoredHeight);
  });
});
