// ---
// relationships:
//   implements: expressions-configuration
// ---
export const expressionsConfigurationSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  properties: { timeoutMs: { type: "integer", minimum: 250, maximum: 60000, default: 1000 } },
} as const;
