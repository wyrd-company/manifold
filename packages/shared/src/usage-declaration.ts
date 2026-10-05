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
let accountsValidator: ValidateFunction<{ accounts?: Record<string, UsageAccount> }> | undefined;
let pricesValidator:
  | ValidateFunction<{ unit?: "usd"; models?: Record<string, UsagePriceEntry> }>
  | undefined;
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
function capacityFindings(name: string, account: UsageAccount, findings: UsageFinding[]) {
  const path = `/accounts/${pointer(name)}/capacity`;
  const invalid = (field: string, message: string) =>
    findings.push({
      file: "accounts",
      kind: "invalid-capacity",
      location: `${path}/${field}`,
      message,
    });
  const { amount, reset, every } = account.capacity;
  const millionths = Math.round(amount * 1000000);
  const [coefficient = "", exponent = "0"] = String(amount).toLowerCase().split("e");
  const decimals = (coefficient.split(".")[1]?.length ?? 0) - Number(exponent);
  if (!Number.isSafeInteger(millionths) || millionths < 1 || decimals > 6)
    invalid(
      "amount",
      "Capacity must convert to 1 through Number.MAX_SAFE_INTEGER millionths with at most six fractional digits.",
    );
  const match =
    /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|[+-](\d{2}):(\d{2}))$/.exec(
      reset,
    );
  const at = Date.parse(reset);
  const date = new Date(at);
  let valid =
    !!match &&
    Number.isFinite(at) &&
    at >= Date.parse("0001-01-01T00:00:00Z") &&
    at <= Date.parse("9999-12-31T23:59:59.999Z");
  if (match) {
    const year = Number(match[1]),
      month = Number(match[2]),
      day = Number(match[3]);
    const calendar = new Date(0);
    calendar.setUTCFullYear(year, month - 1, day);
    valid &&=
      calendar.getUTCFullYear() === year &&
      calendar.getUTCMonth() === month - 1 &&
      calendar.getUTCDate() === day &&
      Number(match[4]) < 24 &&
      Number(match[5]) < 60 &&
      Number(match[6]) < 60 &&
      Number(match[7] ?? 0) < 24 &&
      Number(match[8] ?? 0) < 60;
  }
  if (!valid)
    invalid("reset", "Reset must be an RFC 3339 instant within UTC years 0001 through 9999.");
  else if ("months" in every && date.getUTCDate() > 28)
    invalid("reset", "A monthly reset must fall on or before day 28 in UTC.");
}
export function lintUsageDeclaration(files: {
  accounts: string | undefined;
  prices: string | undefined;
}): UsageLintResult {
  accountsValidator ??= ajv.compile<{ accounts?: Record<string, UsageAccount> }>(
    accountsDeclarationSchema,
  );
  pricesValidator ??= ajv.compile<{ unit?: "usd"; models?: Record<string, UsagePriceEntry> }>(
    priceTableSchema,
  );
  const findings: UsageFinding[] = [];
  const accounts = document(files.accounts, "accounts", accountsValidator, findings);
  const prices = document(files.prices, "prices", pricesValidator, findings);
  for (const [name, account] of Object.entries(accounts?.accounts ?? {}))
    capacityFindings(name, account, findings);
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
  for (const [id, entry] of Object.entries(prices?.models ?? {}))
    for (const speed of ["standard", "fast"] as const) {
      const rates = entry[speed];
      if (
        rates?.cacheWrite !== undefined &&
        rates.cacheWriteOneHour !== undefined &&
        rates.cacheWriteOneHour < rates.cacheWrite
      )
        findings.push({
          file: "prices",
          kind: "schema",
          location: `/models/${pointer(id)}/${speed}/cacheWriteOneHour`,
          message: "One-hour cache-write price must be at least the default cache-write price.",
        });
    }
  if (findings.length) return { ok: false, findings };
  const declaration: UsageDeclaration = {
    accounts: accounts?.accounts ?? {},
    prices: { unit: "usd", models: prices?.models ?? {} },
  };
  return { ok: true, declaration };
}
