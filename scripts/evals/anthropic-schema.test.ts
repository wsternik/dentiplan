import { describe, expect, it } from "vitest";

import { sanitizeAnthropicSchema } from "./anthropic-schema";

describe("sanitizeAnthropicSchema", () => {
  it("removes unsupported constraints recursively without mutating the source", () => {
    const source = {
      type: "object",
      minProperties: 1,
      properties: {
        label: { type: "string", minLength: 2, pattern: "^[a-z]+$" },
        values: {
          type: "array",
          minItems: 1,
          items: { type: "integer", minimum: 0, maximum: 10 },
        },
      },
      $defs: {
        nested: { anyOf: [{ type: "number", multipleOf: 2 }, { type: "boolean" }] },
      },
    } as const;

    expect(sanitizeAnthropicSchema(source)).toEqual({
      type: "object",
      properties: {
        label: { type: "string" },
        values: { type: "array", items: { type: "integer" } },
      },
      $defs: {
        nested: { anyOf: [{ type: "number" }, { type: "boolean" }] },
      },
    });
    expect(source.properties.label.minLength).toBe(2);
  });

  it("preserves structural and descriptive keywords", () => {
    const schema = {
      type: "object",
      description: "wire contract",
      required: ["status"],
      additionalProperties: false,
      properties: {
        status: { type: "string", enum: ["ok", "warning"], description: "state" },
      },
    } as const;

    expect(sanitizeAnthropicSchema(schema)).toEqual(schema);
  });
});
