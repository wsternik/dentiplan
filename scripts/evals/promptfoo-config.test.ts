import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const config = readFileSync(resolve(process.cwd(), "evals/prefill/promptfooconfig.yaml"), "utf8");

describe("Promptfoo Anthropic configuration", () => {
  it("keeps Sonnet 5 on adaptive thinking with medium effort and no temperature", () => {
    const sonnet = config.slice(
      config.indexOf("- id: anthropic:messages:claude-sonnet-5"),
      config.indexOf("- id: anthropic:messages:claude-haiku-4-5"),
    );

    expect(sonnet).toContain("thinking:\n        type: adaptive");
    expect(sonnet).toContain("output_config:\n          effort: medium");
    expect(sonnet).toContain("showThinking: false");
    expect(sonnet).not.toContain("temperature:");
  });
});
