// ---
// relationships:
//   realizes: task-metadata-declaration
// ---
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "yaml";
const schema = parse(
  readFileSync(
    new URL("../../../docs/specifications/task-metadata-declaration.schema.yml", import.meta.url),
    "utf8",
  ),
);
writeFileSync(
  new URL("../src/task-metadata-schema.ts", import.meta.url),
  `// ---\n// relationships:\n//   realizes: task-metadata-declaration\n// ---\n// Generated from the specification asset; agreement is tested.\nexport const taskMetadataDeclarationSchema = ${JSON.stringify(schema, null, 2)};\n`,
);
