import { describe, expect, it } from "vitest";

import { resolvePricelistItem } from "@/lib/pricing";

import {
  approvalBlockReason,
  buildQuoteContent,
  DiagnosisNoteSchema,
  PatientEmailSchema,
  QuotePayloadSchema,
} from "./quote-payload";

// Real pricelist ids — the point of this module is that ids resolve against the
// live seed, so fixtures would defeat the test.
const TOOTH_ITEM = "leczenie-zachowawcze:znieczulenie";
const GENERAL_ITEM = "profilaktyka:higienizacja";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    patient_type: "adult",
    teeth: [{ number: 16, pricelistItemIds: [TOOTH_ITEM] }],
    visits: [],
    generalItems: [],
    ...overrides,
  };
}

describe("QuotePayloadSchema", () => {
  it("accepts a minimal well-formed payload and applies schema defaults", () => {
    const parsed = QuotePayloadSchema.parse(payload());
    expect(parsed.teeth[0]).toMatchObject({ status: "in-plan", note: "", treatmentType: null, visitNumber: null });
  });

  it("rejects a tooth number outside the FDI range", () => {
    expect(() => QuotePayloadSchema.parse(payload({ teeth: [{ number: 99, pricelistItemIds: [] }] }))).toThrow();
  });

  it("rejects a note longer than the 500-character bound", () => {
    const teeth = [{ number: 16, note: "x".repeat(501), pricelistItemIds: [] }];
    expect(() => QuotePayloadSchema.parse(payload({ teeth }))).toThrow();
  });

  it("rejects an unknown patient type", () => {
    expect(() => QuotePayloadSchema.parse(payload({ patient_type: "teenager" }))).toThrow();
  });

  it("has no slot for an e-mail — a stray one is stripped, never carried", () => {
    const parsed = QuotePayloadSchema.parse(payload({ patient_email: "dentystka@example.com" }));
    expect(parsed).not.toHaveProperty("patient_email");
  });

  it("has no slot for a diagnosis note — a stray one is stripped, never carried", () => {
    const parsed = QuotePayloadSchema.parse(payload({ diagnosis_note: "Poufna notatka dentystki" }));
    expect(parsed).not.toHaveProperty("diagnosis_note");
  });
});

describe("buildQuoteContent", () => {
  it("resolves each pricelist item server-side by id", () => {
    const content = buildQuoteContent(QuotePayloadSchema.parse(payload()));
    expect(content.teeth[0].pricelistItems).toEqual([resolvePricelistItem(TOOTH_ITEM)]);
  });

  it("ignores a client-sent price in favour of the resolved one (FR-050)", () => {
    // The editor POSTs ids only, but a tampered client could send a full item.
    // Whatever it sends, the stored price must come from the seed.
    const teeth = [{ number: 16, pricelistItemIds: [TOOTH_ITEM], price: { kind: "fixed", amount: 1 } }];
    const content = buildQuoteContent(QuotePayloadSchema.parse(payload({ teeth })));
    expect(content.teeth[0].pricelistItems[0].price).toEqual(resolvePricelistItem(TOOTH_ITEM).price);
  });

  it("throws on a dangling pricelist reference", () => {
    const parsed = QuotePayloadSchema.parse(payload({ teeth: [{ number: 16, pricelistItemIds: ["nope:nope"] }] }));
    expect(() => buildQuoteContent(parsed)).toThrow();
  });

  it("resolves general items too", () => {
    const generalItems = [{ id: "g-1", itemId: GENERAL_ITEM }];
    const content = buildQuoteContent(QuotePayloadSchema.parse(payload({ generalItems })));
    expect(content.generalItems[0].item).toEqual(resolvePricelistItem(GENERAL_ITEM));
  });

  it("leaves totals unset — only approval computes the frozen number", () => {
    expect(buildQuoteContent(QuotePayloadSchema.parse(payload())).totals).toBeUndefined();
  });

  // Risk #3 (context/foundation/test-plan.md): `content` is returned verbatim to
  // anon by `get_quote_by_token`, so an e-mail nested anywhere inside it would be
  // patient-visible. The guard is structural — the builder has no e-mail slot —
  // and this asserts it over the serialised bytes, not the object shape, because
  // that is what the RPC actually hands out.
  it("never lets an e-mail reach content, wherever it was smuggled in", () => {
    const email = "pacjentka@example.com";
    const content = buildQuoteContent(
      QuotePayloadSchema.parse(
        payload({
          patient_email: email,
          teeth: [{ number: 16, pricelistItemIds: [TOOTH_ITEM], patient_email: email }],
          generalItems: [{ id: "g-1", itemId: GENERAL_ITEM, patient_email: email }],
        }),
      ),
    );
    expect(JSON.stringify(content)).not.toContain(email);
    expect(JSON.stringify(content)).not.toContain("example.com");
  });
});

describe("approvalBlockReason", () => {
  it("blocks an empty quote", () => {
    const content = buildQuoteContent(QuotePayloadSchema.parse(payload({ teeth: [] })));
    expect(approvalBlockReason(content)).toBe("Kosztorys jest pusty.");
  });

  it("blocks an in-plan tooth with no pricelist item", () => {
    const teeth = [{ number: 16, pricelistItemIds: [] }];
    const content = buildQuoteContent(QuotePayloadSchema.parse(payload({ teeth })));
    expect(approvalBlockReason(content)).toBe("Każdy ząb w planie musi mieć pozycję z cennika.");
  });

  it("allows an unpriced tooth that is not in the plan", () => {
    const teeth = [
      { number: 16, pricelistItemIds: [TOOTH_ITEM] },
      { number: 17, status: "out-of-current-plan", pricelistItemIds: [] },
    ];
    const content = buildQuoteContent(QuotePayloadSchema.parse(payload({ teeth })));
    expect(approvalBlockReason(content)).toBeNull();
  });

  it("allows a quote made only of general items", () => {
    const generalItems = [{ id: "g-1", itemId: GENERAL_ITEM }];
    const content = buildQuoteContent(QuotePayloadSchema.parse(payload({ teeth: [], generalItems })));
    expect(approvalBlockReason(content)).toBeNull();
  });
});

describe("PatientEmailSchema", () => {
  it("accepts a well-formed address", () => {
    expect(PatientEmailSchema.parse("pacjentka@example.com")).toBe("pacjentka@example.com");
  });

  it("rejects a malformed address and an over-long one", () => {
    expect(() => PatientEmailSchema.parse("pacjentka")).toThrow();
    expect(() => PatientEmailSchema.parse(`${"x".repeat(250)}@example.com`)).toThrow();
  });
});

describe("DiagnosisNoteSchema", () => {
  it("preserves a non-empty note verbatim", () => {
    expect(DiagnosisNoteSchema.parse("  Pierwsza linia\nDruga linia  ")).toBe("  Pierwsza linia\nDruga linia  ");
  });

  it.each([undefined, null, "", " \n\t "])("normalises %j to null", (value) => {
    expect(DiagnosisNoteSchema.parse(value)).toBeNull();
  });

  it("rejects a note longer than the prefill limit", () => {
    expect(() => DiagnosisNoteSchema.parse("x".repeat(4001))).toThrow();
  });
});
