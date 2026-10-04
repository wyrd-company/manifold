// ---
// relationships:
//   implements: expressions-configuration
// ---
// Generated from the specification asset; agreement is tested.
export const expressionsConfigurationSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://manifold.wyrd.company/schemas/expressions-configuration",
  title: "Expressions configuration",
  description: "The value of the `expressions` section of the service configuration.",
  type: "object",
  additionalProperties: false,
  properties: {
    timeoutMs: {
      description:
        "The longest the calling thread waits for one blueprint expression evaluation, in milliseconds, including a worker start when one is due. An evaluation that reaches it fails as an expression error of kind `evaluation`, and the expression worker is restarted.",
      type: "integer",
      minimum: 250,
      maximum: 60000,
      default: 1000,
    },
  },
} as const;
