import { describe, expect, it } from "vitest";

import { listGeneralItems, listToothItems } from "../../src/lib/pricing";
import { MAX_PROPOSED_VISITS } from "../../src/lib/llm/visits";
import { buildPolishInstructions } from "./polish-prompt";

describe("buildPolishInstructions", () => {
  it("uses every live Polish catalog item without translating its name", () => {
    const instructions = buildPolishInstructions();
    const missing = [...listToothItems(), ...listGeneralItems()].filter(
      (item) => !instructions.includes(item.id) || !instructions.includes(item.name),
    );

    expect(missing).toEqual([]);
  });

  it("preserves the wire fields and safety rules of the production prompt", () => {
    const instructions = buildPolishInstructions();

    expect(instructions).toContain("warnings");
    expect(instructions).toContain("urgencyFromNote");
    expect(instructions).toContain("rationale");
    expect(instructions).toContain("out-of-current-plan");
    expect(instructions).toContain("visitNumber = 0");
    expect(instructions).toContain(String(MAX_PROPOSED_VISITS));
    expect(instructions).toContain("Nigdy nie wymyślaj id");
    expect(instructions).toContain("Nie dobieraj najbliższej pozycji");
    expect(instructions).toContain("nie zwijaj normalnego podziału do jednej wizyty");
  });
});
