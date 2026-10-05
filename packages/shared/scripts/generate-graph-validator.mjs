// ---
// relationships:
//   realizes: blueprint
// ---
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Ajv2020 } from "ajv/dist/2020.js";
import standaloneCode from "ajv/dist/standalone/index.js";
import { parse } from "yaml";
const ajv = new Ajv2020({
  strict: false,
  validateFormats: false,
  code: { source: true, esm: true },
});
const schemas = [];
for (const name of ["blueprint-expressions", "blueprint"]) {
  const schema = parse(
    readFileSync(
      new URL(`../../../docs/specifications/${name}.schema.yml`, import.meta.url),
      "utf8",
    ),
  );
  schemas.push(schema);
  ajv.addSchema(schema);
}
const validate = ajv.compile({
  $ref: "https://manifold.wyrd.company/schemas/blueprint#/$defs/blueprint",
});
writeFileSync(
  new URL("../src/blueprint-validator.js", import.meta.url),
  "// ---\n// relationships:\n//   realizes: blueprint\n// ---\n// Generated; do not edit.\n// Schema digest: " +
    createHash("sha256").update(JSON.stringify(schemas)).digest("hex") +
    "\n" +
    standaloneCode(ajv, validate).replace(
      'const func1 = require("ajv/dist/runtime/ucs2length").default;',
      "const func1 = value => [...value].length;",
    ),
);
