// ---
// relationships:
//   implements: [blueprint-expressions, blueprint-loader]
// ---
import { agentToolsSchema } from "./agent-tools-schema.ts";
import { Ajv2020 } from "ajv/dist/2020.js";
import { serviceConfigurationSchemas } from "./service-configuration-schemas.ts";
import { escalationContractSchema } from "./escalation-contract-schema.ts";
import type { Schema } from "./expression-sites.ts";

// Reuse compiled meta-schemas within a lint operation. A group's schemas may
// reference each other; separate boundaries can reuse ids independently.
export function createSchemaCompiler() {
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
  return (schemas: readonly Schema[]) => {
    try {
      for (const schema of serviceConfigurationSchemas) ajv.addSchema(schema);
      ajv.addSchema(escalationContractSchema);
      ajv.addSchema(agentToolsSchema);
      return schemas.map((schema) => ajv.compile(schema));
    } finally {
      // Ajv retains meta-schemas and compiled validators remain usable.
      ajv.removeSchema();
    }
  };
}
