import { describe, expect, it } from "vitest";

import { gradeParsedDiagnosis, type EvalExpectation } from "./assertions";

const expected: EvalExpectation = {
  teeth: [
    {
      number: 36,
      treatmentType: "root-canal",
      urgency: "urgent",
      urgencyFromNote: true,
      status: "in-plan",
      pricelistItemIds: ["leczenie-kanalowe:leczenie-kanalowe-trzonowca"],
    },
    {
      number: 37,
      treatmentType: "filling",
      urgency: "moderate",
      urgencyFromNote: false,
      status: "in-plan",
      pricelistItemIds: ["leczenie-zachowawcze:wypelnienie-male-duze"],
    },
  ],
  generalItems: [{ id: "profilaktyka:higienizacja", visitNumber: 2 }],
  visitGroups: [[36], [37]],
  warningTokens: ["mikroskop"],
  forbiddenWarningTokens: [],
};

const valid = {
  teeth: [
    {
      number: 36,
      treatmentType: "root-canal",
      urgency: "urgent",
      urgencyFromNote: true,
      status: "in-plan",
      pricelistItemIds: ["leczenie-kanalowe:leczenie-kanalowe-trzonowca"],
      visitNumber: 3,
    },
    {
      number: 37,
      treatmentType: "filling",
      urgency: "moderate",
      urgencyFromNote: false,
      status: "in-plan",
      pricelistItemIds: ["leczenie-zachowawcze:wypelnienie-male-duze"],
      visitNumber: 2,
    },
  ],
  generalItems: [{ id: "profilaktyka:higienizacja", visitNumber: 2 }],
  visits: [
    { number: 2, rationale: "Kanałowe." },
    { number: 3, rationale: "Wypełnienie." },
  ],
  warnings: ["Nie umieszczono frazy: mikroskop."],
};

describe("gradeParsedDiagnosis", () => {
  it("passes a schema-valid answer whose exact atoms match", () => {
    const grade = gradeParsedDiagnosis(JSON.stringify(valid), expected);

    expect(grade.pass).toBe(true);
    expect(grade.score).toBe(1);
  });

  it("rejects a malformed wire response before domain checks", () => {
    const grade = gradeParsedDiagnosis("{", expected);

    expect(grade.pass).toBe(false);
    expect(grade.componentResults[0].reason).toContain("wire-schema");
    expect(grade.componentResults.every((result) => !result.pass)).toBe(true);
  });

  it("marks an invented FDI tooth as a safety failure", () => {
    const grade = gradeParsedDiagnosis(
      JSON.stringify({
        ...valid,
        teeth: [...valid.teeth, { ...valid.teeth[0], number: 99 }],
      }),
      expected,
    );

    expect(grade.componentResults.some((result) => !result.pass && result.reason.includes("[safety]"))).toBe(true);
    expect(grade.reason).toContain("99");
  });

  it("marks an invented billable item as a safety failure", () => {
    const grade = gradeParsedDiagnosis(
      JSON.stringify({
        ...valid,
        teeth: [
          {
            ...valid.teeth[0],
            pricelistItemIds: [...valid.teeth[0].pricelistItemIds, "leczenie-zachowawcze:znieczulenie"],
          },
          valid.teeth[1],
        ],
      }),
      expected,
    );

    expect(
      grade.componentResults.some(
        (result) =>
          !result.pass &&
          result.reason.includes("[safety] tooth-36-no-invented-treatment") &&
          result.reason.includes("leczenie-zachowawcze:znieczulenie"),
      ),
    ).toBe(true);
  });

  it("keeps a missing expected tooth in quality scoring without making it a safety failure", () => {
    const grade = gradeParsedDiagnosis(JSON.stringify({ ...valid, teeth: [valid.teeth[0]] }), expected);
    const failed = grade.componentResults.filter((result) => !result.pass);

    expect(failed.some((result) => result.reason.includes("[quality] exact-tooth-set"))).toBe(true);
    expect(failed.some((result) => result.reason.includes("[safety]"))).toBe(false);
  });

  it("canonicalizes visit and tooth order", () => {
    const grade = gradeParsedDiagnosis(
      JSON.stringify({
        ...valid,
        teeth: [valid.teeth[1], valid.teeth[0]],
        visits: [valid.visits[1], valid.visits[0]],
      }),
      expected,
    );

    expect(grade.componentResults.find((result) => result.reason.includes("canonical-visit-groups"))?.pass).toBe(true);
  });

  it("matches required warning tokens without freezing prose", () => {
    const grade = gradeParsedDiagnosis(
      JSON.stringify({ ...valid, warnings: ["MIKROSKOP pozostaje do weryfikacji"] }),
      expected,
    );

    expect(grade.componentResults.find((result) => result.reason.includes("warning-contains"))?.pass).toBe(true);
  });
});
