// ---
// relationships:
//   realizes: blueprint
// ---
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "yaml";
const header = `// ---\n// relationships:\n//   realizes: [blueprint, blueprint-expressions]\n// ---\n/* eslint-disable unicorn/no-thenable -- JSON Schema uses the then keyword. */\n// Generated from the specification assets; agreement is tested.\n`;
let source = header;
for (const [file, name] of [
  ["blueprint", "blueprintSchema"],
  ["blueprint-expressions", "blueprintExpressionsSchema"],
]) {
  const schema = parse(
    readFileSync(
      new URL(`../../../docs/specifications/${file}.schema.yml`, import.meta.url),
      "utf8",
    ),
  );
  source += `export const ${name} = ${JSON.stringify(schema, null, 2)};\n`;
}
writeFileSync(new URL("../src/blueprint-schema.ts", import.meta.url), source);
