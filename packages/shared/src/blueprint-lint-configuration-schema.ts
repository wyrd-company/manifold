// ---
// relationships:
//   realizes: blueprint-lint-configuration
// ---
export const blueprintLintConfigurationSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://manifold.wyrd.company/schemas/blueprint-lint-configuration",
  title: "Blueprint lint configuration",
  description: "The value of the `blueprintLint` section of the service configuration.",
  type: "object",
  additionalProperties: false,
  properties: {
    configurationBound: {
      description:
        "The configurations one blueprint's token lint graph may hold before each of its gates has the verdict `unknown`.",
      type: "integer",
      minimum: 1,
      default: 20000,
    },
  },
} as const;
