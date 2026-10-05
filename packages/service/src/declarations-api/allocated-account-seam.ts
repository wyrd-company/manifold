// ---
// relationships:
//   implements: [portfolio-declaration, accounts-declaration]
// ---
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";
import { parse } from "yaml";
// Structural stand-in for the reviewed allocated-account lint; removed when its shared export merges.
import {
  serviceConfigurationSchemas,
  portfolioDeclarationSchema,
  accountsDeclarationSchema,
  usageRecordSchema,
} from "@wyrd-company/manifold-shared";
import type { UsageAccount } from "@wyrd-company/manifold-shared";
type ItemDocument = { allocations?: Record<string, unknown>; items?: Record<string, ItemDocument> };
type PortfolioDocument = { items?: Record<string, ItemDocument> };
const pointerSegment = (key: string) => key.replaceAll("~", "~0").replaceAll("/", "~1");

export type PortfolioWarning = {
  file: "portfolio";
  location: string;
  kind: "account-undeclared";
  severity: "warning";
  message: string;
  details: { item: string; account: string };
};
const ajv = new Ajv2020({ strict: false, validateFormats: false });
for (const schema of serviceConfigurationSchemas) ajv.addSchema(schema);
ajv.addSchema(usageRecordSchema);
let portfolioValidator: ValidateFunction<PortfolioDocument> | undefined;
let accountsValidator: ValidateFunction<{ accounts?: Record<string, UsageAccount> }> | undefined;

function document<T>(text: string | undefined, validate: ValidateFunction<T>): T | undefined {
  let value: unknown;
  try {
    value = text === undefined ? {} : (parse(text) ?? {});
    JSON.stringify(value);
  } catch {
    return undefined;
  }
  return validate(value) ? value : undefined;
}

export function lintAllocatedAccounts(files: {
  portfolio: string | undefined;
  accounts: string | undefined;
}): readonly PortfolioWarning[] {
  portfolioValidator ??= ajv.compile<PortfolioDocument>(portfolioDeclarationSchema);
  accountsValidator ??= ajv.compile<{ accounts?: Record<string, UsageAccount> }>(
    accountsDeclarationSchema,
  );
  const portfolio = document(files.portfolio, portfolioValidator);
  const accounts = document(files.accounts, accountsValidator);
  if (portfolio === undefined || accounts === undefined) return [];
  const declared = new Set(Object.keys(accounts.accounts ?? {}));
  const warnings: PortfolioWarning[] = [];
  function visit(items: Record<string, ItemDocument>, parent: string | null, location: string) {
    for (const [name, entry] of Object.entries(items)) {
      const item = name === "other" && parent !== null ? `${parent}/other` : name;
      const path = `${location}/${pointerSegment(name)}`;
      for (const account of Object.keys(entry.allocations ?? {})) {
        if (declared.has(account)) continue;
        warnings.push({
          file: "portfolio",
          location: `${path}/allocations/${pointerSegment(account)}`,
          kind: "account-undeclared",
          severity: "warning",
          message: `Account "${account}" is not declared in accounts.yml.`,
          details: { item, account },
        });
      }
      visit(entry.items ?? {}, item, `${path}/items`);
    }
  }
  visit(portfolio.items ?? {}, null, "/items");
  return warnings;
}
