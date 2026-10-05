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
      "accounts:\n  acct:\n    unit: usd\n    kind: api\n    capacity: { amount: 1, reset: '2026-01-01T00:00:00Z', every: { hours: 1 } }\n    usage: [{ environment: env-one, provider: codex }]\n  acct-alt:\n    unit: usd\n    kind: api\n    capacity: { amount: 1, reset: '2026-01-01T00:00:00Z', every: { hours: 1 } }\n    usage: [{ environment: env-one, provider: codex }]\n",
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

it.each(["standard", "fast"])("rejects a cheaper one-hour cache write at %s speed", (speed) => {
  expect(
    lintUsageDeclaration({
      accounts: undefined,
      prices: `unit: usd
models:
  model-a:
    ${speed === "fast" ? "standard: { input: 2, output: 8 }" : ""}
    ${speed}: { input: 2, output: 8, cacheWrite: 4, cacheWriteOneHour: 1 }`,
    }),
  ).toMatchObject({
    ok: false,
    findings: [{ file: "prices", location: `/models/model-a/${speed}/cacheWriteOneHour` }],
  });
  expect(
    lintUsageDeclaration({
      accounts: undefined,
      prices: `unit: usd
models:
  model-a:
    ${speed === "fast" ? "standard: { input: 2, output: 8 }" : ""}
    ${speed}: { input: 2, output: 8, cacheWrite: 4, cacheWriteOneHour: 4 }`,
    }),
  ).toMatchObject({ ok: true });
});

it.each([
  ["amount", 0.0000001],
  ["amount", 1.1234567],
  ["amount", 1e12],
  ["reset", "2026-02-30T00:00:00Z"],
  ["reset", "2026-01-01"],
  ["reset", "0001-01-01T00:00:00+01:00"],
  ["reset", "2026-01-29T00:00:00Z"],
])("locates invalid capacity %s = %s", (field, value) => {
  const capacity = {
    amount: 1,
    reset: "2026-01-01T00:00:00Z",
    every: { months: 1 },
    [field]: value,
  };
  expect(
    lintUsageDeclaration({
      accounts: JSON.stringify({ accounts: { acct: { unit: "usd", kind: "api", capacity } } }),
      prices: undefined,
    }),
  ).toMatchObject({
    ok: false,
    findings: [{ kind: "invalid-capacity", location: `/accounts/acct/capacity/${field}` }],
  });
});
it("requires capacity at its pointer", () => {
  expect(
    lintUsageDeclaration({
      accounts: "accounts: { acct: { unit: usd, kind: api } }",
      prices: undefined,
    }),
  ).toMatchObject({
    ok: false,
    findings: [{ kind: "schema", location: "/accounts/acct/capacity" }],
  });
});

it("accepts accounts with capacity and no usage or prices", () => {
  expect(
    lintUsageDeclaration({
      accounts: JSON.stringify({
        accounts: {
          acct: {
            unit: "usd",
            kind: "subscription",
            capacity: { amount: 120, reset: "2026-01-01T00:00:00Z", every: { days: 7 } },
          },
        },
      }),
      prices: undefined,
    }),
  ).toMatchObject({ ok: true, declaration: { prices: { unit: "usd", models: {} } } });
});
it.each([
  ["hours", 87600],
  ["days", 3650],
  ["months", 120],
])("bounds the %s period", (unit, maximum) => {
  const accounts = (n: number) =>
    JSON.stringify({
      accounts: {
        acct: {
          unit: "usd",
          kind: "api",
          capacity: { amount: 1, reset: "2026-01-01T00:00:00Z", every: { [unit]: n } },
        },
      },
    });
  expect(lintUsageDeclaration({ accounts: accounts(maximum), prices: undefined }).ok).toBe(true);
  expect(
    lintUsageDeclaration({ accounts: accounts(maximum + 1), prices: undefined }),
  ).toMatchObject({
    ok: false,
    findings: [{ kind: "schema", location: `/accounts/acct/capacity/every/${unit}` }],
  });
});
it.each(["0001-01-01T00:00:00Z", "9999-12-31T23:59:59.999Z", "2026-01-01T01:00:00+01:00"])(
  "accepts representable reset %s",
  (reset) => {
    expect(
      lintUsageDeclaration({
        accounts: JSON.stringify({
          accounts: {
            acct: {
              unit: "usd",
              kind: "api",
              capacity: { amount: 1.000001, reset, every: { hours: 1 } },
            },
          },
        }),
        prices: undefined,
      }).ok,
    ).toBe(true);
  },
);

it.each(["0001-01-01T00:00:00+01:00", "9999-12-31T23:59:59-01:00"])(
  "rejects offset resets outside four-digit UTC years: %s",
  (reset) => {
    expect(
      lintUsageDeclaration({
        accounts: JSON.stringify({
          accounts: {
            acct: { unit: "usd", kind: "api", capacity: { amount: 1, reset, every: { hours: 1 } } },
          },
        }),
        prices: undefined,
      }),
    ).toMatchObject({
      ok: false,
      findings: [{ kind: "invalid-capacity", location: "/accounts/acct/capacity/reset" }],
    });
  },
);
