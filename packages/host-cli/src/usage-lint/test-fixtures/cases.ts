// ---
// relationships:
//   verifies: [host-cli-usage, usage-intake]
// ---
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
const account = (amount = 1) => `accounts:
  acct:
    unit: usd
    kind: api
    capacity: { amount: ${amount}, reset: '2026-01-01T00:00:00Z', every: { hours: 1 } }
`;
export const usageLintCases = [
  { name: "clean", accounts: account(), prices: undefined, finding: undefined },
  { name: "empty", accounts: undefined, prices: undefined, finding: undefined },
  {
    name: "amount",
    accounts: account(0.0000001),
    prices: undefined,
    finding: "accounts.yml:/accounts/acct/capacity/amount invalid-capacity ",
  },
  {
    name: "missing-capacity",
    accounts: "accounts: { acct: { unit: usd, kind: api } }",
    prices: undefined,
    finding: "accounts.yml:/accounts/acct/capacity schema ",
  },
  {
    name: "duplicate-model",
    accounts: account(),
    prices:
      "unit: usd\nmodels:\n  first: { aliases: [second], standard: { input: 1, output: 1 } }\n  second: { standard: { input: 1, output: 1 } }",
    finding: "prices.yml:/models/second duplicate-model ",
  },
  { name: "syntax", accounts: "[", prices: undefined, finding: "accounts.yml: syntax " },
  {
    name: "ordering",
    accounts: account(0.0000001),
    prices: "unit: usd\nmodels: { first: { standard: { input: 1 } } }",
    finding: "accounts.yml:/accounts/acct/capacity/amount invalid-capacity ",
  },
];
export async function writeUsageLintCase(
  directory: string,
  fixture: (typeof usageLintCases)[number],
) {
  await mkdir(directory);
  for (const [file, text] of [
    ["accounts.yml", fixture.accounts],
    ["prices.yml", fixture.prices],
  ] as const)
    if (text !== undefined) await writeFile(join(directory, file), text);
}
