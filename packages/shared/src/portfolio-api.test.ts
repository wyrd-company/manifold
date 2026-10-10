// ---
// relationships:
//   verifies: portfolio-api
// ---
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import Ajv from "ajv/dist/2020.js";
import { expect, test } from "vite-plus/test";
import { isPortfolioResponse } from "./portfolio-api.ts";
const openapi = parse(
  readFileSync(
    new URL("../../../docs/specifications/portfolio-api.openapi.yml", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv.default({ strict: false, validateFormats: false });
const validate = ajv.compile({
  $ref: "#/components/schemas/PortfolioResponse",
  components: openapi.components,
});
const account = {
  name: "acct-a",
  declared: true,
  unit: "usd",
  kind: "api",
  capacity: { amount: 10000000, reset: "2026-01-01T00:00:00Z", every: { days: 1 } },
  window: {
    key: "w1",
    opensAt: "2026-01-01T00:00:00.000Z",
    closesAt: "2026-01-02T00:00:00.000Z",
    capacity: 10000000,
    used: 17700,
  },
};
const allocation = {
  account: "acct-a",
  declared: true,
  guarantee: 50,
  ceiling: 70,
  weight: 2,
  pacing: { burst: 5 },
  amount: 5000000,
  actual: 17700,
  outstanding: 0,
  available: 4982300,
  reservable: 4982300,
  lifetime: 17700,
};
const item = {
  id: "alpha",
  parent: null,
  title: "Alpha",
  other: false,
  archived: false,
  projects: {
    github: [{ binding: "sample", owner: "example", number: 1 }],
    t3code: [{ environment: "local", project: "sample", via: "binding", binding: "sample" }],
  },
  completedTasks: 0,
  activeTasks: 1,
  allocations: [allocation],
};
const body = {
  commit: "a".repeat(40),
  pricing: {
    bundledCommit: "a".repeat(40),
    bundledModels: 1,
    overrides: 0,
    unpriced: [],
    unmetered: [],
  },
  at: "2026-01-01T00:00:00.000Z",
  accounts: [account],
  items: [item],
  unallocated: [{ account: "acct-a", percent: 50, amount: 5000000 }],
  warnings: [
    {
      file: "portfolio",
      kind: "account-undeclared",
      location: "/items/alpha/allocations/acct-c",
      severity: "warning",
      message: "Not declared",
      details: { account: "acct-c", item: "alpha" },
    },
  ],
};
test("portfolio guard agrees with the OpenAPI shape across nested valid and invalid bodies", () => {
  for (const value of [
    body,
    {
      ...body,
      commit: null,
      pricing: {
        bundledCommit: "a".repeat(40),
        bundledModels: 1,
        overrides: 0,
        unpriced: [],
        unmetered: [],
      },
      accounts: [],
      items: [{ ...item, projects: { github: [], t3code: [] }, allocations: [] }],
      warnings: [],
    },
    { ...body, accounts: [{ name: "acct-c", declared: false }] },
    {
      ...body,
      accounts: [{ ...account, archived: true, lastUsedAt: body.at }],
      pricing: {
        ...body.pricing,
        unpriced: [{ provider: "codex", model: null, postings: 1 }],
        unmetered: [{ provider: "cursor", model: "sample-model", postings: 2 }],
      },
    },
  ]) {
    expect(validate(value)).toBe(true);
    expect(isPortfolioResponse(value)).toBe(true);
  }
  for (const value of [
    null,
    {},
    { ...body, items: [] },
    { ...body, extra: true },
    { ...body, pricing: undefined },
    {
      ...body,
      pricing: (({ unmetered: _unmetered, ...pricing }) => pricing)(body.pricing),
    },
    { ...body, pricing: { ...body.pricing, bundledCommit: "bad" } },
    {
      ...body,
      pricing: {
        ...body.pricing,
        unpriced: [{ provider: "unknown", model: "sample", postings: 1 }],
      },
    },
    {
      ...body,
      pricing: { ...body.pricing, unpriced: [{ provider: "codex", model: null, postings: 0 }] },
    },
    {
      ...body,
      pricing: {
        ...body.pricing,
        unmetered: [{ provider: "cursor", model: null, postings: 0 }],
      },
    },
    { ...body, accounts: [{ ...account, archived: "true" }] },
    { ...body, accounts: [{ ...account, unit: "tokens" }] },
    { ...body, items: [{ ...item, allocations: [{ ...allocation, guarantee: 101 }] }] },
    {
      ...body,
      items: [
        {
          ...item,
          projects: { github: [], t3code: [{ environment: "a", project: "b", via: "unknown" }] },
        },
      ],
    },
    { ...body, unallocated: [{ account: "a", percent: 50, amount: -1 }] },
    { ...body, warnings: [{ ...body.warnings[0], severity: "error" }] },
  ]) {
    expect(validate(value)).toBe(false);
    expect(isPortfolioResponse(value)).toBe(false);
  }
});

test("last-used timestamps are checked at the response boundary", () => {
  expect(isPortfolioResponse({ ...body, accounts: [{ ...account, lastUsedAt: "bad" }] })).toBe(
    false,
  );
});
