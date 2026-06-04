// Patient-facing formatting unit tests (S-01, Phase 4).
//
// Locale grouping (the thousands separator pl-PL emits) is ICU-dependent, so we
// avoid asserting exact whitespace and pin the behavioural contract instead:
// the "od X zł" range framing, the point-cost collapse, the range-upside guard,
// and the UTC-stable date format.

import { describe, it, expect } from "vitest";
import { formatAmount, formatRangeHeadline, hasRangeUpside, formatDate } from "./format";

describe("formatAmount", () => {
  it("appends the zł suffix and keeps the digits", () => {
    expect(formatAmount(1400)).toMatch(/zł$/);
    expect(formatAmount(0)).toBe("0 zł");
  });
});

describe("formatRangeHeadline", () => {
  it("renders a point cost bare", () => {
    expect(formatRangeHeadline({ min: 500, max: 500 })).toBe("500 zł");
  });

  it("renders a true range as the lower-bound headline with 'od'", () => {
    const out = formatRangeHeadline({ min: 500, max: 900 });
    expect(out.startsWith("od ")).toBe(true);
    expect(out).toContain("500");
    expect(out).not.toContain("900");
  });
});

describe("hasRangeUpside", () => {
  it("is false for a point cost and true for a real range", () => {
    expect(hasRangeUpside({ min: 500, max: 500 })).toBe(false);
    expect(hasRangeUpside({ min: 500, max: 900 })).toBe(true);
  });
});

describe("formatDate", () => {
  it("formats an ISO timestamp as DD.MM.YYYY in UTC", () => {
    expect(formatDate("2026-06-04T09:30:00.000Z")).toBe("04.06.2026");
    // Late-UTC instant must not roll the day forward/back regardless of TZ.
    expect(formatDate("2026-01-09T23:59:59.000Z")).toBe("09.01.2026");
  });
});
