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

  it("states the two rules that keep the output honest", () => {
    const instructions = buildInstructions().toLowerCase();

    // Never propose a treatment the note does not mention (PRD Non-Goals), and
    // put what you cannot place into `warnings` rather than guessing (FR-012).
    expect(instructions).toContain("warnings");
    expect(instructions).toMatch(/nie ma w notatce|nie wymieniono|nie występuje w notatce/);
  });
});
