// ---
// relationships:
//   verifies: [accounts-declaration, price-table, usage-push]
// ---
import { expect, it } from "vite-plus/test";
import { lintUsageDeclaration } from "./usage-declaration.ts";
import { bundledPriceTable } from "./prices.generated.ts";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import {
  accountsDeclarationSchema,
  priceTableSchema,
  usagePushSchema,
  usageRecordSchema,
} from "./usage-schemas.generated.ts";
import { serviceConfigurationSchemas } from "./service-configuration-schemas.ts";
import { Ajv2020 } from "ajv/dist/2020.js";
it("accepts empty declarations and rejects duplicate usage across accounts", () => {
  expect(lintUsageDeclaration({ accounts: undefined, prices: "" })).toEqual({
    ok: true,
    declaration: { accounts: {}, prices: { unit: "usd", models: {} } },
  });
  const result = lintUsageDeclaration({
    accounts:
      "accounts:\n  acct:\n    unit: usd\n    usage: [{ environment: env-one, provider: codex }]\n  acct-alt:\n    unit: usd\n    usage: [{ environment: env-one, provider: codex }]\n",
    prices: undefined,
  });
  expect(result).toMatchObject({
    ok: false,
    findings: [{ kind: "duplicate-usage", location: "/accounts/acct-alt/usage/0" }],
  });
});
it("reports syntax, schema and duplicate-model locations", () => {
  expect(lintUsageDeclaration({ accounts: "[", prices: undefined })).toMatchObject({
    ok: false,
    findings: [{ file: "accounts", kind: "syntax", location: "" }],
  });
  expect(
    lintUsageDeclaration({ accounts: "accounts: { 1acct: { unit: usd } }", prices: undefined }),
  ).toMatchObject({
    ok: false,
    findings: expect.arrayContaining([
      {
        file: "accounts",
        kind: "schema",
        location: "/accounts/1acct",
        message: expect.any(String),
      },
    ]),
  });
  expect(
    lintUsageDeclaration({
      accounts: undefined,
      prices:
        "unit: usd\nmodels:\n  model-a: { aliases: [model-b], standard: { input: 2, output: 8 } }\n  model-b: { standard: { input: 1, output: 1 } }",
    }),
  ).toMatchObject({
    ok: false,
    findings: [{ kind: "duplicate-model", location: "/models/model-b" }],
  });
});
it("embeds the specified schemas and a valid nonempty USD price table", () => {
  for (const [name, schema] of [
    ["accounts-declaration", accountsDeclarationSchema],
    ["price-table", priceTableSchema],
    ["usage-push", usagePushSchema],
    ["usage-record", usageRecordSchema],
  ] as const)
    expect(schema).toEqual(
      parse(
        readFileSync(
          new URL(`../../../docs/specifications/${name}.schema.yml`, import.meta.url),
          "utf8",
        ),
      ),
    );
  const ajv = new Ajv2020({ strict: false, validateFormats: false });
  for (const schema of serviceConfigurationSchemas) ajv.addSchema(schema);
  ajv.addSchema(usageRecordSchema);
  ajv.compile(accountsDeclarationSchema);
  ajv.compile(usagePushSchema);
  expect(ajv.compile(priceTableSchema)(bundledPriceTable)).toBe(true);
  expect(bundledPriceTable.unit).toBe("usd");
  expect(Object.keys(bundledPriceTable.models).length).toBeGreaterThan(100);
});
