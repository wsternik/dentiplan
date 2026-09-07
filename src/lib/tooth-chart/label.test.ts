import { describe, expect, it } from "vitest";

import type { ChartTooth } from "./model";
import { chartLabel } from "./label";
import { toothCenter } from "./geometry";

function tooth(overrides: Partial<ChartTooth> = {}): ChartTooth {
  return {
    number: 11,
    slot: 0,
    shapeIndex: 0,
    dentition: "permanent",
    scale: 1,
    arcOffset: 0,
    name: "11 — siekacz przyśrodkowy prawy górny",
    inQuote: true,
    urgency: "moderate",
    status: "in-plan",
    treatmentType: "filling",
    treatmentLabel: "wypełnienie",
    statusLabel: "w planie",
    cost: { min: 300, max: 300 },
    ...overrides,
  };
}

describe("chartLabel", () => {
  it("places the FDI number at the transformed centre of a planned tooth", () => {
    const planned = tooth({ number: 55, scale: 0.85, arcOffset: -0.5 });
    const label = chartLabel(planned);

    expect(label).toEqual({ text: "55", x: toothCenter(planned)[0], y: toothCenter(planned)[1] });
  });

  it("does not label teeth outside the quote", () => {
    expect(chartLabel(tooth({ inQuote: false, urgency: null, status: null }))).toBeNull();
  });
});
