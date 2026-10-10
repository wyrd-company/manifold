// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { findingField } from "./findings.ts";
test.each([
  ["/accounts/acct", "name"],
  ["/accounts/acct/capacity/amount", "amount"],
  ["/accounts/acct/capacity/reset", "reset"],
  ["/accounts/acct/capacity/every", "window"],
  ["/accounts/acct/capacity/every/hours", "window"],
  ["/accounts/acct/usage/2/provider", "usage:2"],
  ["/accounts/another/capacity/amount", undefined],
])("maps %s to %s", (location, field) => {
  expect(
    findingField(
      { file: "accounts", kind: "schema", location: location!, message: "Invalid value" },
      "acct",
    ),
  ).toBe(field);
});
