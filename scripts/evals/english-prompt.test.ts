import { describe, expect, it } from "vitest";

import { listGeneralItems, listToothItems } from "../../src/lib/pricing";
import { MAX_PROPOSED_VISITS } from "../../src/lib/llm/visits";
import { buildEnglishInstructions } from "./english-prompt";

describe("buildEnglishInstructions", () => {
  it("uses every live Polish catalog item without translating its name", () => {
    const instructions = buildEnglishInstructions();
    const missing = [...listToothItems(), ...listGeneralItems()].filter(
      (item) => !instructions.includes(item.id) || !instructions.includes(item.name),
    );

    expect(missing).toEqual([]);
  });

  it("preserves the wire fields and safety rules of the production prompt", () => {
    const instructions = buildEnglishInstructions();

    expect(instructions).toContain("warnings");
    expect(instructions).toContain("urgencyFromNote");
    expect(instructions).toContain("rationale");
    expect(instructions).toContain("out-of-current-plan");
    expect(instructions).toContain("visitNumber = 0");
    expect(instructions).toContain(String(MAX_PROPOSED_VISITS));
    expect(instructions).toContain("Never invent an id");
    expect(instructions).toContain("do not collapse the normal split into one visit");
  });
});
