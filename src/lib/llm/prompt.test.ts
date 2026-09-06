// Risk #7, upstream half: the mapper can only drop an invented pricelist id
// after the fact. The cheapest way to stop one being invented is to hand the
// model the catalog and tell it those are the only ids that exist.
//
// So the assertion here is not "the prompt mentions the pricelist" — it is that
// EVERY live id is in the text, and that the tooth and general catalogs are
// kept apart. A prompt that silently loses an item is a prompt that makes the
// model guess, and the failure would otherwise surface as a warning the
// dentystka has to read rather than as a red test.

import { describe, expect, it } from "vitest";

import { listGeneralItems, listToothItems } from "@/lib/pricing";

import { buildInstructions } from "./prompt";
import { MAX_PROPOSED_VISITS } from "./visits";

/**
 * The body of one `## ` section, so a rule can be asserted where it belongs
 * rather than anywhere in a prompt that also carries the whole pricelist.
 */
function section(instructions: string, heading: string): string {
  const start = instructions.indexOf(`## ${heading}`);
  if (start === -1) return "";
  const next = instructions.indexOf("\n## ", start + 1);
  return instructions.slice(start, next === -1 ? undefined : next);
}

describe("buildInstructions", () => {
  it("carries every live pricelist id, so the model never has to invent one", () => {
    const instructions = buildInstructions();
    const missing = [...listToothItems(), ...listGeneralItems()]
      .map((item) => item.id)
      .filter((id) => !instructions.includes(id));

    expect(missing).toEqual([]);
  });

  it("keeps the per-tooth and general catalogs apart", () => {
    const instructions = buildInstructions();

    // `profilaktyka:higienizacja` is general-only and `...:wypelnienie-male-duze`
    // is tooth-only; if the two lists were merged the model would be free to put
    // either anywhere, and the mapper would spend its warnings saying so.
    const generalSection = instructions.indexOf("profilaktyka:higienizacja");
    const toothSection = instructions.indexOf("leczenie-zachowawcze:wypelnienie-male-duze");

    expect(generalSection).toBeGreaterThan(-1);
    expect(toothSection).toBeGreaterThan(-1);
    expect(generalSection).not.toEqual(toothSection);
  });

  // Everything below is hers to reword (B12) — she has to be able to turn "2–3
  // zęby na wizytę" into "4" without a red test. So these assert STRUCTURE: that
  // each rule still has a section to live in, and that the fields the schema
  // requires are explained somewhere in the text. The alternation of Polish
  // phrasings that used to stand here did neither — it passed as long as
  // *something* was written nearby, and it turned red on a rule she had improved.
  it("keeps the rules section, with `warnings` as the escape hatch", () => {
    const rules = section(buildInstructions(), "Zasady");

    // FR-012: what the model cannot place is named, never guessed at. Unlike her
    // wording, `warnings` is a wire-contract token — asserting it freezes nothing.
    expect(rules).not.toEqual("");
    expect(rules).toContain("warnings");
  });

  it("keeps a section for each thing the model is asked to propose", () => {
    const instructions = buildInstructions();

    expect(section(instructions, "Grupowanie wizyt")).not.toEqual("");
    expect(section(instructions, "Pilność")).not.toEqual("");
  });

  it("explains both fields the model fills in on its own", () => {
    const instructions = buildInstructions();

    // `urgencyFromNote` and `rationale` are required by `schema.ts`, so the model
    // answers with them whether or not it was told what they mean. Unexplained,
    // it fills them with something — and the FR-015 warning built on
    // `urgencyFromNote` is then confidently wrong.
    expect(instructions).toContain("urgencyFromNote");
    expect(instructions).toContain("rationale");
  });

  it("forbids designing the anesthesia variant", () => {
    // FR-041–FR-044 computes that variant from the in-plan teeth. A model that
    // imitates it by collapsing the plan to one visit produces a split that looks
    // deliberate and is not (plan: "What We're NOT Doing").
    expect(section(buildInstructions(), "Znieczulenie ogólne")).not.toEqual("");
  });

  it("states the same visit ceiling the mapper enforces", () => {
    // `mapParsedDiagnosis` warns above `MAX_PROPOSED_VISITS`. If the prompt asked
    // for a different number, every run of the larger one would warn — the
    // instruction and the check have to be one constant, not two numerals that
    // agree today.
    const grouping = section(buildInstructions(), "Grupowanie wizyt");
    const ceiling = new RegExp(`(?<!\\d)${MAX_PROPOSED_VISITS}(?!\\d)`);

    expect(grouping).toMatch(ceiling);
  });
});
