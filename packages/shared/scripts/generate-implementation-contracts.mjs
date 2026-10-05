// ---
// relationships:
//   realizes: [agent-threads, escalation-contract]
// ---
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "yaml";
const load = (name) =>
  parse(
    readFileSync(
      new URL(`../../../docs/specifications/${name}.schema.yml`, import.meta.url),
      "utf8",
    ),
  );
function contract(schema, name) {
  function expand(value) {
    if (Array.isArray(value)) return value.map(expand);
    if (value === null || typeof value !== "object") return value;
    if (typeof value.$ref === "string" && value.$ref.startsWith("#/$defs/"))
      return expand(schema.$defs[value.$ref.slice(8)]);
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, expand(child)]));
  }
  return expand(schema.$defs[name]);
}
const threads = load("agent-threads"),
  escalation = load("escalation-contract");
const contracts = {
  "thread-create": {
    input: contract(threads, "thread-create-input"),
    output: contract(threads, "thread-create-output"),
  },
  "turn-prepare": {
    input: contract(threads, "turn-prepare-input"),
    output: contract(threads, "turn-prepare-output"),
  },
  "turn-start": {
    input: contract(threads, "turn-start-input"),
    output: contract(threads, "turn-start-output"),
  },
  escalate: { input: contract(escalation, "escalate-input"), output: true },
};
writeFileSync(
  new URL("../src/implementation-contracts.ts", import.meta.url),
  "// ---\n// relationships:\n//   realizes: [agent-threads, escalation-contract]\n// ---\n// Generated from specification schema assets.\nexport const implementationContracts = " +
    JSON.stringify(contracts, null, 2) +
    ";\n",
);
