// ---
// relationships:
//   verifies: usage-api
// ---
import { expect, test } from "vite-plus/test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { isUsageMoveRequest, isUsageMoveResponse, isUsageUnownedResponse } from "./usage-api.ts";
const api = parse(
  readFileSync(
    new URL("../../../docs/specifications/usage-api.openapi.yml", import.meta.url),
    "utf8",
  ),
) as { components: { schemas: Record<string, object> } };
const ajv = new Ajv2020({ strict: false, validateFormats: false });
const validate = (name: string) =>
  ajv.compile({ ...api.components.schemas[name], components: api.components });
test("usage request guard agrees with the native specification and refuses extra or ambiguous targets", () => {
  const check = validate("UsageMoveRequest");
  for (const v of [
    { from: "thread:env-one:one", to: { item: "alpha" } },
    { from: "session:env-one:codex:one", to: { actor: "task:parcel" } },
    {},
    { from: "task:parcel", to: { item: "alpha" } },
    { from: "thread:env-one:", to: { item: "alpha" } },
    { from: "thread:env-one:one", to: { item: "" } },
    { from: "thread:env-one:one", to: { item: "alpha", actor: "task:parcel" } },
    { from: "thread:env-one:one", to: { item: "alpha" }, extra: true },
  ])
    expect(isUsageMoveRequest(v)).toBe(check(v));
});
test("usage response guards agree with the native specification on populated, zero and malformed reads", () => {
  const move = {
    status: "moved",
    from: "thread:env-one:one",
    to: { actor: "task:parcel", item: "alpha" },
    moved: 1,
    accounts: [{ account: "acct", amount: 0 }],
  };
  for (const value of [
    move,
    { ...move, moved: -1 },
    { ...move, accounts: [{ account: "acct", amount: -1 }] },
    { ...move, extra: true },
  ])
    expect(isUsageMoveResponse(value)).toBe(validate("UsageMoveResponse")(value));
  const entry = {
    actor: "thread:env-one:one",
    kind: "thread",
    environment: "env-one",
    threadId: "one",
    title: "A recipe",
    lastUsedAt: new Date(0).toISOString(),
    pending: 1,
    unmetered: 2,
    usage: [{ item: "alpha", account: "acct", amount: 0, calls: 1 }],
  };
  for (const value of [
    { unowned: [] },
    { unowned: [entry] },
    { unowned: [{ ...entry, pending: -1 }] },
    { unowned: [{ ...entry, unmetered: -1 }] },
    { unowned: [(({ unmetered: _unmetered, ...value }) => value)(entry)] },
    { unowned: [{ ...entry, usage: [{ ...entry.usage[0], calls: 0 }] }] },
    { unowned: [entry], extra: true },
  ])
    expect(isUsageUnownedResponse(value)).toBe(validate("UsageUnownedResponse")(value));
});
