// ---
// relationships:
//   references: price-table
// ---
import { writeFileSync } from "node:fs";
// LiteLLM's price source; refresh this commit and regenerate together.
const commit = "e1d16f51d14849c1b3decf17cd81a3bcb4863dca";
const response = await fetch(
  `https://raw.githubusercontent.com/BerriAI/litellm/${commit}/model_prices_and_context_window.json`,
);
if (!response.ok) throw new Error(`Price source answered ${response.status}`);
const source = await response.json();
const models = {};
const fields = {
  input: "input_cost_per_token",
  output: "output_cost_per_token",
  cacheRead: "cache_read_input_token_cost",
  cacheWrite: "cache_creation_input_token_cost",
  cacheWriteOneHour: "cache_creation_input_token_cost_above_1hr",
  reasoning: "output_cost_per_reasoning_token",
};
for (const [model, row] of Object.entries(source)) {
  if (typeof row.input_cost_per_token !== "number" || typeof row.output_cost_per_token !== "number")
    continue;
  const standard = {};
  for (const [field, key] of Object.entries(fields))
    if (typeof row[key] === "number" && row[key] >= 0) standard[field] = row[key] * 1000000;
  if (standard.input === undefined || standard.output === undefined) continue;
  models[model] = { standard };
}
writeFileSync(
  new URL("../src/prices.generated.ts", import.meta.url),
  `// ---\n// relationships:\n//   implements: price-table\n// ---\n// Generated from LiteLLM at ${commit}; Apache-2.0.\nimport type {PriceTable} from './usage-types.ts';\nexport const bundledPriceTableCommit = ${JSON.stringify(commit)};\nexport const bundledPriceTable:PriceTable = ${JSON.stringify({ unit: "usd", models }, null, 2)};\n`,
);
