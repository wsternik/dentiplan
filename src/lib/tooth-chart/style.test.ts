import { describe, expect, it } from "vitest";

import { STATUS_SHAPE, URGENCY_FILL } from "@/lib/quote/marks";
import type { ToothStatus, Urgency } from "@/types";

import { toothClasses } from "./style";
import type { ChartTooth } from "./model";

const URGENCIES: (Urgency | "unknown")[] = ["urgent", "moderate", "mild", "unknown"];
const STATUSES: ToothStatus[] = ["in-plan", "uncertain", "out-of-current-plan"];

function chartTooth(overrides: Partial<ChartTooth> = {}): ChartTooth {
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
    cost: { min: 1, max: 1 },
    ...overrides,
  };
}

describe("chart marks", () => {
  it("has a fill for every urgency including the unrecorded one — a chart cannot omit a tooth", () => {
    for (const urgency of URGENCIES) {
      expect(URGENCY_FILL[urgency], urgency).toMatch(/^fill-urgency-/);
    }
  });

  it("expresses every status as a shape treatment, never as a hue", () => {
    for (const status of STATUSES) {
      expect(STATUS_SHAPE[status], status).toBeTruthy();
      expect(STATUS_SHAPE[status], status).not.toMatch(/urgency/);
    }
  });

  it("resolves every urgency × status pair to static classes, with no interpolated names", () => {
    for (const urgency of URGENCIES) {
      for (const status of STATUSES) {
        const classes = toothClasses(chartTooth({ urgency: urgency === "unknown" ? null : urgency, status }));
        expect(classes, `${urgency}/${status}`).toContain(URGENCY_FILL[urgency]);
        expect(classes).not.toMatch(/\$\{|undefined/);
      }
    }
  });

  it("draws a tooth outside the quote unmarked, so an unfilled tooth says nothing", () => {
    const classes = toothClasses(chartTooth({ inQuote: false, urgency: null, status: null }));
    expect(classes).toContain("fill-none");
    expect(classes).not.toContain("fill-urgency-");
  });

  it("dims an out-of-current-plan tooth once, never compounding it with a second dim", () => {
    const classes = toothClasses(chartTooth({ status: "out-of-current-plan" }));
    expect(classes.match(/opacity-/g) ?? []).toHaveLength(1);
  });
});
