// ---
// relationships:
//   implements: [accounts-declaration, price-table]
// ---
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";
import { parse } from "yaml";
import { serviceConfigurationSchemas } from "./service-configuration-schemas.ts";
import {
  accountsDeclarationSchema,
  priceTableSchema,
  usageRecordSchema,
} from "./usage-schemas.generated.ts";
import type {
  UsageDeclaration,
  UsageLintResult,
  UsageFinding,
  UsageAccount,
  UsagePriceEntry,
} from "./usage-types.ts";
const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
for (const schema of serviceConfigurationSchemas) ajv.addSchema(schema);
ajv.addSchema(usageRecordSchema);
const accountsValidator = ajv.compile<{ accounts?: Record<string, UsageAccount> }>(
  accountsDeclarationSchema,
);
const pricesValidator = ajv.compile<{ unit?: "usd"; models?: Record<string, UsagePriceEntry> }>(
  priceTableSchema,
);
const pointer = (value: string) => value.replaceAll("~", "~0").replaceAll("/", "~1");
function document<T>(
  text: string | undefined,
  file: UsageFinding["file"],
  validate: ValidateFunction<T>,
  findings: UsageFinding[],
): T | undefined {
  let value: unknown;
  try {
    value = text === undefined ? {} : (parse(text) ?? {});
  } catch (error) {
    findings.push({ file, kind: "syntax", location: "", message: String(error) });
    return;
  }
  try {
    JSON.stringify(value);
  } catch {
    findings.push({
      file,
      kind: "schema",
      location: "",
      message: "Declaration must be a JSON value.",
    });
    return;
  }
  if (validate(value)) return value;
  for (const error of validate.errors ?? []) {
    const property =
      error.propertyName ?? error.params["missingProperty"] ?? error.params["additionalProperty"];
    findings.push({
      file,
      kind: "schema",
      location: error.instancePath + (typeof property === "string" ? "/" + pointer(property) : ""),
      message: error.message ?? "Invalid declaration.",
    });
  }
}
export function lintUsageDeclaration(files: {
  accounts: string | undefined;
  prices: string | undefined;
}): UsageLintResult {
  const findings: UsageFinding[] = [];
  const accounts = document(files.accounts, "accounts", accountsValidator, findings);
  const prices = document(files.prices, "prices", pricesValidator, findings);
  const seenUsage = new Set<string>();
  for (const [name, account] of Object.entries(accounts?.accounts ?? {}))
    for (const [index, usage] of (account.usage ?? []).entries()) {
      const key = JSON.stringify([usage.environment, usage.provider, usage.instance ?? null]);
      if (seenUsage.has(key))
        findings.push({
          file: "accounts",
          kind: "duplicate-usage",
          location: `/accounts/${pointer(name)}/usage/${index}`,
          message: "Usage already names an account.",
        });
      seenUsage.add(key);
    }
  const seenModels = new Set<string>();
  for (const [id, entry] of Object.entries(prices?.models ?? {}))
    for (const [index, model] of [id, ...(entry.aliases ?? [])].entries()) {
      if (seenModels.has(model))
        findings.push({
          file: "prices",
          kind: "duplicate-model",
          location: `/models/${pointer(id)}` + (index ? `/aliases/${index - 1}` : ""),
          message: "Model already has a price entry.",
        });
      seenModels.add(model);
    }
  if (findings.length) return { ok: false, findings };
  const declaration: UsageDeclaration = {
    accounts: accounts?.accounts ?? {},
    prices: { unit: "usd", models: prices?.models ?? {} },
  };
  return { ok: true, declaration };
}
