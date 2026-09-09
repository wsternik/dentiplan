import { buildPolishInstructions } from "../../../scripts/evals/polish-prompt.ts";

export default function polishPrompt({ vars }) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Promptfoo's callback boundary is untyped.
  const note = String(vars.note);
  return JSON.stringify([
    { role: "system", content: buildPolishInstructions() },
    { role: "user", content: `Notatka dentystki:\n\n${note}` },
  ]);
}
