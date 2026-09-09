import { buildInstructions } from "../../../src/lib/llm/prompt.ts";

export default function productionPrompt({ vars }) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Promptfoo's callback boundary is untyped.
  const note = String(vars.note);
  return JSON.stringify([
    { role: "system", content: buildInstructions() },
    { role: "user", content: `Notatka dentystki:\n\n${note}` },
  ]);
}
