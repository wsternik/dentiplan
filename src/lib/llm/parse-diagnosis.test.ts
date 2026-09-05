// Risk #7 (`context/foundation/test-plan.md`): "The LLM puts something in the
// form the dentystka never wrote — a pricelist item that is not in the catalog,
// or a tooth number outside FDI — and it reaches approval."
//
// What would prove protection: for a model answer that is PERFECTLY VALID
// against the wire schema, the tree handed to the editor contains only teeth
// that exist and only items that are in the seed, and everything dropped is
// named in a warning. Each fixture is parsed through `ParsedDiagnosisSchema`
// first — that step is part of the assertion, not setup. It is what shows the
// schema cannot catch these cases: Anthropic's structured output rejects
// `minimum`/`maximum` on a number (see `scripts/review/agent.ts`), so tooth 99
// arrives schema-valid and only code can stop it.
//
// The fixtures are recorded model answers; the pricelist is the real seed, for
// the same reason `quote-payload.test.ts` uses real ids — a fixture catalog
// would test the fixture.

import { describe, expect, it } from "vitest";

import { ParsedDiagnosisSchema } from "./schema";
import { mapParsedDiagnosis } from "./parse-diagnosis";

import clean from "./fixtures/clean.json";
import unknownPricelistId from "./fixtures/unknown-pricelist-id.json";
import outOfRangeTooth from "./fixtures/out-of-range-tooth.json";
import uncertainMarker from "./fixtures/uncertain-marker.json";

/** Parse a recorded answer the way the adapter does, so fixtures stay honest. */
function readFixture(raw: unknown) {
  return ParsedDiagnosisSchema.parse(raw);
}

describe("mapParsedDiagnosis", () => {
  it("maps a clean answer onto the tree the editor holds, with prices from the seed", () => {
    const { content, warnings } = mapParsedDiagnosis(readFixture(clean));

    expect(content.teeth.map((t) => t.number)).toEqual([17, 16, 34, 37, 36]);
    expect(warnings).toEqual([]);

    // The price comes from the seed, never from the model — 1200 zł is what the
    // pricelist says a molar root canal costs.
    const molar = content.teeth.find((t) => t.number === 37);
    expect(molar?.pricelistItems).toHaveLength(1);
    expect(molar?.pricelistItems[0]).toMatchObject({
      id: "leczenie-kanalowe:leczenie-kanalowe-trzonowca",
      price: { kind: "fixed", amount: 1200 },
    });

    expect(content.visits).toEqual([
      { number: 1, label: "Wypełnienia" },
      { number: 2, label: "Leczenie kanałowe" },
    ]);
    expect(content.generalItems.map((i) => i.id)).toEqual(["profilaktyka:higienizacja"]);
  });

  it("risk #7: a tooth number outside FDI is dropped and named, and the valid teeth survive", () => {
    const parsed = readFixture(outOfRangeTooth);
    // The schema is happy with it. That is the whole problem.
    expect(parsed.teeth.map((t) => t.number)).toContain(99);

    const { content, warnings } = mapParsedDiagnosis(parsed);

    expect(content.teeth.map((t) => t.number)).toEqual([16]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("99");
  });

  it("risk #7: a pricelist id that is not in the seed is dropped and named, and its tooth survives", () => {
    const { content, warnings } = mapParsedDiagnosis(readFixture(unknownPricelistId));

    const tooth = content.teeth.find((t) => t.number === 16);
    expect(tooth?.pricelistItems.map((i) => i.id)).toEqual(["leczenie-kanalowe:leczenie-kanalowe-trzonowca"]);

    expect(warnings.some((w) => w.includes("mikroskop-endodontyczny"))).toBe(true);
    expect(warnings.some((w) => w.includes("skaling-naddziaslowy"))).toBe(true);
    // The model's own unrecognised-phrase warning is carried through, not swallowed.
    expect(warnings.some((w) => w.includes("pod mikroskopem"))).toBe(true);
  });

  it("risk #7: an item that exists but is not valid for a tooth is not attached to one", () => {
    const { content, warnings } = mapParsedDiagnosis(readFixture(unknownPricelistId));

    // `profilaktyka:higienizacja` is a real id, but it is a general item — a
    // catalog-membership check alone would have let it through onto tooth 26.
    const tooth = content.teeth.find((t) => t.number === 26);
    expect(tooth?.pricelistItems).toEqual([]);
    expect(warnings.some((w) => w.includes("higienizacja"))).toBe(true);
  });

  it("keeps an uncertain tooth out of a visit, and drops a visit reference that was never declared", () => {
    const { content, warnings } = mapParsedDiagnosis(readFixture(uncertainMarker));

    // `(32?)` — planned as uncertain, so FR-030 says it belongs to no visit,
    // even though the model assigned one.
    const uncertain = content.teeth.find((t) => t.number === 32);
    expect(uncertain).toMatchObject({ status: "uncertain", visitNumber: null, treatmentType: null, urgency: null });

    // Visit 3 was never declared; an in-plan tooth must not carry a dangling ref.
    const inPlan = content.teeth.find((t) => t.number === 36);
    expect(inPlan?.visitNumber).toBeNull();
    expect(warnings.some((w) => w.includes("36"))).toBe(true);
  });

  it("risk #7: the same tooth proposed twice in one answer is kept once and named", () => {
    // Found in impl review. The editor keys tooth rows by number, so a model
    // that lists 16 under two headings in the note would have produced two rows
    // with the same React key and two copies of that tooth in the quote.
    const parsed = ParsedDiagnosisSchema.parse({
      teeth: [
        {
          number: 16,
          treatmentType: "root-canal",
          urgency: "urgent",
          status: "in-plan",
          pricelistItemIds: ["leczenie-kanalowe:leczenie-kanalowe-trzonowca"],
          visitNumber: 0,
        },
        {
          number: 16,
          treatmentType: "filling",
          urgency: "mild",
          status: "in-plan",
          pricelistItemIds: ["leczenie-zachowawcze:wypelnienie-male-duze"],
          visitNumber: 0,
        },
      ],
      generalItemIds: ["profilaktyka:higienizacja", "profilaktyka:higienizacja"],
      visits: [],
      warnings: [],
    });

    const { content, warnings } = mapParsedDiagnosis(parsed);

    expect(content.teeth.map((t) => t.number)).toEqual([16]);
    // The first reading wins; the second is reported rather than merged, because
    // merging two contradictory readings would invent a third one.
    expect(content.teeth[0].treatmentType).toBe("root-canal");
    expect(content.generalItems.map((i) => i.id)).toEqual(["profilaktyka:higienizacja"]);
    expect(warnings.filter((w) => w.includes("dwukrotnie"))).toHaveLength(2);
  });

  it("never lets the model write a patient-visible note", () => {
    for (const fixture of [clean, unknownPricelistId, outOfRangeTooth, uncertainMarker]) {
      const { content } = mapParsedDiagnosis(readFixture(fixture));
      expect(content.teeth.every((t) => t.note === "")).toBe(true);
    }
  });
});
