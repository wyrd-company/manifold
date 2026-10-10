// ---
// relationships:
//   implements: [portfolio-declaration, accounts-declaration]
// ---
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";
import { parse } from "yaml";
import { serviceConfigurationSchemas } from "./service-configuration-schemas.ts";
import { portfolioDeclarationSchema } from "./portfolio-declaration-schema.ts";
import { accountsDeclarationSchema, usageRecordSchema } from "./usage-schemas.generated.ts";
import type { PortfolioDocument, ItemDocument } from "./portfolio-declaration-types.ts";
import type { UsageAccount } from "./usage-types.ts";
import { pointerSegment } from "./portfolio-normalization.ts";

export type PortfolioWarning = {
  file: "portfolio";
  location: string;
  kind: "account-undeclared" | "account-archived";
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
  const warnings: PortfolioWarning[] = [];
  function visit(items: Record<string, ItemDocument>, parent: string | null, location: string) {
    for (const [name, entry] of Object.entries(items)) {
      const item = name === "other" && parent !== null ? `${parent}/other` : name;
      const path = `${location}/${pointerSegment(name)}`;
      for (const account of Object.keys(entry.allocations ?? {})) {
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
  return classifyAllocatedAccounts(warnings, accounts.accounts ?? {});
}

export function classifyAllocatedAccounts(
  warnings: readonly PortfolioWarning[],
  accounts: Readonly<Record<string, UsageAccount>>,
): readonly PortfolioWarning[] {
  return warnings.flatMap((warning) => {
    const account = Object.hasOwn(accounts, warning.details.account)
      ? accounts[warning.details.account]
      : undefined;
    if (!account) return [warning];
    if (!account.archived) return [];
    return [
      {
        ...warning,
        kind: "account-archived" as const,
        message: `Account "${warning.details.account}" is archived in accounts.yml.`,
      },
    ];
  });
}
