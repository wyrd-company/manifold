// ---
// relationships:
//   implements: [blueprint-expressions, blueprint-loader]
// ---
import { Ajv2020 } from "ajv/dist/2020.js";
import type { Schema } from "./expression-sites.ts";

// Reuse compiled meta-schemas within a lint operation. A group's schemas may
// reference each other; separate boundaries can reuse ids independently.
export function createSchemaCompiler() {
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
  return (schemas: readonly Schema[]) => {
    try {
      return schemas.map((schema) => ajv.compile(schema));
    } finally {
      // Ajv retains meta-schemas and compiled validators remain usable.
      ajv.removeSchema();
    }
  };
}
