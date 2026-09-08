type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** Validation keywords rejected by Anthropic's structured-output decoder. */
export const UNSUPPORTED_ANTHROPIC_SCHEMA_KEYS = new Set([
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minProperties",
  "maxProperties",
  "not",
]);

/**
 * Return a provider-facing copy without weakening the production Zod schema.
 * The generic traversal also reaches arrays, $defs and future nested shapes.
 */
export function sanitizeAnthropicSchema(value: unknown): JsonValue {
  if (Array.isArray(value)) return value.map(sanitizeAnthropicSchema);
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }
  if (typeof value !== "object") throw new TypeError("Schema contains a non-JSON value.");

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !UNSUPPORTED_ANTHROPIC_SCHEMA_KEYS.has(key))
      .map(([key, child]) => [key, sanitizeAnthropicSchema(child)]),
  );
}
