// ---
// relationships:
//   realizes: [agent-threads, escalation-contract, agent-tools, blueprint]
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
const assets = [
  "agent-threads",
  "escalation-contract",
  "agent-tools",
  "blueprint",
  "task-metadata-declaration",
  "service-configuration",
].map(load);
function contract(schema, name) {
  function expand(value, owner = schema) {
    if (Array.isArray(value)) return value.map((child) => expand(child, owner));
    if (value === null || typeof value !== "object") return value;
    if (typeof value.$ref === "string" && value.$ref.includes("#/$defs/")) {
      const [id, member] = value.$ref.split("#/$defs/");
      const target = id ? assets.find((asset) => asset.$id === id) : owner;
      if (target) return expand(target.$defs[member], target);
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, expand(child, owner)]),
    );
  }
  return expand(schema.$defs[name]);
}
const [threads, escalation, tools, blueprint] = assets;
const contracts = {
  "github-card-move": {
    input: contract(blueprint, "card-move-input"),
    output: contract(blueprint, "card-move-output"),
  },
  "send-message": {
    input: contract(tools, "send-message-input"),
    output: contract(tools, "send-message-output"),
  },
  "t3code-project-create": {
    input: contract(threads, "project-create-input"),
    output: contract(threads, "project-create-output"),
  },
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
  "// ---\n// relationships:\n//   realizes: [agent-threads, escalation-contract, agent-tools, blueprint]\n// ---\n// Generated from specification schema assets.\nexport const implementationContracts = " +
    JSON.stringify(contracts, null, 2) +
    ";\n",
);
