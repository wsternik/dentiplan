import { buildEnglishInstructions } from "../../../scripts/evals/english-prompt.ts";

export default function englishPrompt({ vars }) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Promptfoo's callback boundary is untyped.
  const note = String(vars.note);
  return JSON.stringify([
    { role: "system", content: buildEnglishInstructions() },
    { role: "user", content: `Notatka dentystki:\n\n${note}` },
  ]);
}
