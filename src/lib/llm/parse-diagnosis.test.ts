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
import { MAX_PROPOSED_VISITS, VISIT_LABELS } from "./visits";

import clean from "./fixtures/clean.json";
import unknownPricelistId from "./fixtures/unknown-pricelist-id.json";
import outOfRangeTooth from "./fixtures/out-of-range-tooth.json";
import uncertainMarker from "./fixtures/uncertain-marker.json";
import visitSplitByUrgency from "./fixtures/visit-split-by-urgency.json";
import visitsDeclaredInNote from "./fixtures/visits-declared-in-note.json";
import overVisitCeiling from "./fixtures/over-visit-ceiling.json";
import inferredUrgency from "./fixtures/inferred-urgency.json";

const FIXTURES = [
  clean,
  unknownPricelistId,
  outOfRangeTooth,
  uncertainMarker,
  visitSplitByUrgency,
  visitsDeclaredInNote,
  overVisitCeiling,
  inferredUrgency,
];

/** Parse a recorded answer the way the adapter does, so fixtures stay honest. */
function readFixture(raw: unknown) {
  return ParsedDiagnosisSchema.parse(raw);
}

/**
 * The paths in a model answer whose strings are ALLOWED to appear in `content`.
 * Closed vocabularies the schema already constrains, plus the pricelist ids —
 * the resolved refs' ids equal them by construction, and that equality is the
 * point, since each id was checked against the seed first.
 *
 * This list is the whole guard: anything not on it is free text the model wrote
 * and must not reach a patient. Adding a field here is a deliberate act.
 */
const MAY_REACH_CONTENT = new Set([
  "teeth[].treatmentType",
  "teeth[].urgency",
  "teeth[].status",
  "teeth[].pricelistItemIds[]",
  "generalItems[].id",
]);

/** Every string in a model answer, with the path it sits at. */
function modelStrings(value: unknown, path = ""): { path: string; value: string }[] {
  if (typeof value === "string") return [{ path, value }];
  if (Array.isArray(value)) return value.flatMap((entry) => modelStrings(entry, `${path}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, entry]) => modelStrings(entry, path === "" ? key : `${path}.${key}`));
  }
  return [];
}

describe("mapParsedDiagnosis", () => {
  it("maps a clean answer onto the tree the editor holds, with prices from the seed", () => {
    const { content, warnings } = mapParsedDiagnosis(readFixture(clean));

    expect(content.teeth.map((t) => t.number)).toEqual([17, 16, 34, 37, 36]);
    // Nothing was dropped. What is left in the list is the model's own reasoning
    // for the split, attributed to the visit each one ENDED UP as — the painful
    // root canals are visit 1 now, whatever number the model gave them.
    expect(warnings).toEqual([
      "Wizyta 1 — propozycja modelu: Trzy zęby z bólem opisanym w notatce — leczenie kanałowe w pierwszej kolejności.",
      "Wizyta 2 — propozycja modelu: Dwa zęby górne po tej samej stronie, próchnica bez objawów — jedna wizyta zachowawcza.",
    ]);

    // The price comes from the seed, never from the model — 1200 zł is what the
    // pricelist says a molar root canal costs.
    const molar = content.teeth.find((t) => t.number === 37);
    expect(molar?.pricelistItems).toHaveLength(1);
    expect(molar?.pricelistItems[0]).toMatchObject({
      id: "leczenie-kanalowe:leczenie-kanalowe-trzonowca",
      price: { kind: "fixed", amount: 1200 },
    });

    // The labels are ours, from the closed dictionary; the model's `label` field
    // no longer exists. "Leczenie pilne" beats "Leczenie kanałowe" for visit 1
    // because urgency is what decides when she schedules it.
    expect(content.visits).toEqual([
      { number: 1, label: "Leczenie pilne" },
      { number: 2, label: "Leczenie zachowawcze" },
    ]);
    // FR-032: the hygiene the model put in its own visit 1 follows that visit to
    // wherever the ordering moved it — here to visit 2, because the painful root
    // canals took the first slot. An item left on the model's number would price
    // the wrong visit, in a total that adds up perfectly.
    expect(content.generalItems.map((g) => g.item.id)).toEqual(["profilaktyka:higienizacja"]);
    expect(content.generalItems[0].visitNumber).toBe(2);
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

  it("FR-032: a general item pointing at a visit that was never declared keeps its price and loses its visit", () => {
    const { content, warnings } = mapParsedDiagnosis(readFixture(uncertainMarker));

    // Same fixture, same dangling visit 3 — a general item gets the check a tooth
    // already got. Dropping the item instead would quietly delete a pantomogram
    // she is going to be billed for; it lands unassigned and named, and the
    // dropdown in `GeneralItems` is one click away.
    expect(content.generalItems.map((g) => g.item.id)).toEqual(["profilaktyka:rtg-pantomogram"]);
    expect(content.generalItems[0].visitNumber).toBeNull();
    // Named by its catalog name, the way the merge's own skip warning names one —
    // `profilaktyka:rtg-pantomogram` is not what she called it.
    expect(warnings.some((w) => w.includes("Pantomogram") && w.includes("wizyta 3"))).toBe(true);
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
          urgencyFromNote: true,
          status: "in-plan",
          pricelistItemIds: ["leczenie-kanalowe:leczenie-kanalowe-trzonowca"],
          visitNumber: 0,
        },
        {
          number: 16,
          treatmentType: "filling",
          urgency: "mild",
          urgencyFromNote: true,
          status: "in-plan",
          pricelistItemIds: ["leczenie-zachowawcze:wypelnienie-male-duze"],
          visitNumber: 0,
        },
      ],
      // The same item for two visits is one row, the first: dedup is keyed on the
      // item's id, not on (id, visit). Hygiene at visit 1 and visit 4 is a real
      // case and she adds the second by hand.
      generalItems: [
        { id: "profilaktyka:higienizacja", visitNumber: 0 },
        { id: "profilaktyka:higienizacja", visitNumber: 0 },
      ],
      visits: [],
      warnings: [],
    });

    const { content, warnings } = mapParsedDiagnosis(parsed);

    expect(content.teeth.map((t) => t.number)).toEqual([16]);
    // The first reading wins; the second is reported rather than merged, because
    // merging two contradictory readings would invent a third one.
    expect(content.teeth[0].treatmentType).toBe("root-canal");
    expect(content.generalItems.map((g) => g.item.id)).toEqual(["profilaktyka:higienizacja"]);
    expect(warnings.filter((w) => w.includes("dwukrotnie"))).toHaveLength(2);
  });

  it("risk #11: the urgent visit becomes visit 1 and its teeth come with it", () => {
    const { content } = mapParsedDiagnosis(readFixture(visitSplitByUrgency));

    expect(content.visits).toEqual([
      { number: 1, label: "Leczenie pilne" },
      { number: 2, label: "Ekstrakcje" },
      { number: 3, label: "Leczenie zachowawcze" },
    ]);
    // The model listed the painful tooth last. Order is ours, not its.
    expect(content.teeth.find((t) => t.number === 36)?.visitNumber).toBe(1);
    expect(content.teeth.find((t) => t.number === 38)?.visitNumber).toBe(2);
    expect(content.teeth.filter((t) => t.visitNumber === 3).map((t) => t.number)).toEqual([24, 25]);
  });

  it("risk #11: reordering renumbers the visits and never regroups the teeth", () => {
    const parsed = readFixture(visitsDeclaredInNote);
    const { content } = mapParsedDiagnosis(parsed);

    // Whatever the note declared, the model's grouping is the medical judgement
    // we are not second-guessing — only its numbering is ours to change.
    const groupedBefore = parsed.teeth.map((t) => `${t.number}@${t.visitNumber}`);
    expect(groupedBefore).toEqual(["14@1", "15@1", "46@2", "47@2"]);
    expect(content.teeth.filter((t) => t.visitNumber === 1).map((t) => t.number)).toEqual([46, 47]);
    expect(content.teeth.filter((t) => t.visitNumber === 2).map((t) => t.number)).toEqual([14, 15]);
  });

  it("risk #11: more visits than the ceiling is named, and every visit is kept", () => {
    const { content, warnings } = mapParsedDiagnosis(readFixture(overVisitCeiling));

    // Dropping the excess would orphan its teeth through the declared-visit check
    // and cost her exactly the work the button was meant to save. We notice; we
    // do not amputate.
    expect(content.visits).toHaveLength(7);
    expect(content.teeth.every((t) => t.visitNumber !== null)).toBe(true);
    const ceiling = warnings.find((w) => w.includes("7"));
    expect(ceiling).toContain(String(MAX_PROPOSED_VISITS));
  });

  it("risk #11: an urgency the model inferred is named, and one the note stated is not", () => {
    const { warnings } = mapParsedDiagnosis(readFixture(inferredUrgency));

    // The model supplies the boolean; the sentence is composed here, from tooth
    // numbers we have already validated.
    expect(warnings).toEqual(["Pilność dla zębów 36, 24 zaproponował model — nie ma jej wprost w notatce."]);
    // 16 carries the same urgency, read from the note — it is not an inference.
    // 45 has `urgencyFromNote: false` and no urgency at all: nothing was inferred.
  });

  it("never lets the model write anything a patient can read", () => {
    for (const fixture of FIXTURES) {
      const parsed = readFixture(fixture);
      const { content } = mapParsedDiagnosis(parsed);
      const serialized = JSON.stringify(content);

      // Every string the model wrote is checked, not a hand-picked two: naming
      // the fields we know about is how `label` survived a whole slice after
      // `note` was closed (`context/foundation/lessons.md`). The allowlist is
      // the inverse — what may legitimately reach `content` — so a free-text
      // field added tomorrow is covered by default and this test goes red
      // rather than staying quiet.
      const freeText = modelStrings(parsed).filter(
        ({ path, value }) => !MAY_REACH_CONTENT.has(path) && value.trim() !== "",
      );
      for (const { path, value } of freeText) {
        expect(serialized, `${path} reached content`).not.toContain(value);
      }

      expect(content.teeth.every((t) => t.note === "")).toBe(true);
      // The negative check is not enough on its own: Zod strips unknown keys, so
      // a resurrected `label` would vanish rather than fail. This is the positive
      // half — every name she sees came out of our dictionary.
      // `""` counts as ours: it is the "no teeth, nothing to name it after" branch
      // that `VisitList` renders its own placeholder for, not a model string.
      for (const visit of content.visits) {
        expect([...VISIT_LABELS, ""]).toContain(visit.label);
      }
    }
  });

  it("keeps the first of two visits sharing a number, and says so", () => {
    // Two visits with one number are two `VisitList` rows with one React key —
    // and asking the model for a whole schedule makes the collision likelier.
    const parsed = ParsedDiagnosisSchema.parse({
      teeth: [
        {
          number: 16,
          treatmentType: "filling",
          urgency: "mild",
          urgencyFromNote: true,
          status: "in-plan",
          pricelistItemIds: ["leczenie-zachowawcze:wypelnienie-male-duze"],
          visitNumber: 1,
        },
      ],
      generalItems: [],
      visits: [
        { number: 1, rationale: "Pierwsza deklaracja." },
        { number: 1, rationale: "Druga deklaracja tego samego numeru." },
      ],
      warnings: [],
    });

    const { content, warnings } = mapParsedDiagnosis(parsed);

    expect(content.visits).toEqual([{ number: 1, label: "Leczenie zachowawcze" }]);
    expect(warnings.some((w) => w.includes("dwukrotnie"))).toBe(true);
    expect(warnings.some((w) => w.includes("Druga deklaracja"))).toBe(false);
  });
});
