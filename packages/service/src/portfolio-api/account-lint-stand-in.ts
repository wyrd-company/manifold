// ---
// relationships:
//   implements: portfolio-api
// ---
// Replace this adapter with 1177's shared lintAllocatedAccounts at integration.
import { parseDocument, isMap, isScalar } from "yaml";
import type { PortfolioWarning } from "@wyrd-company/manifold-shared/portfolio-api";
const pointer = (v: string) => v.replace(/~/g, "~0").replace(/\//g, "~1");
export function lintAllocatedAccounts(files: {
  portfolio: string | undefined;
  accounts: string | undefined;
}): readonly PortfolioWarning[] {
  const doc = parseDocument(files.portfolio ?? "");
  if (doc.errors.length) return [];
  const names = Object.keys(
    (parseDocument(files.accounts ?? "").toJS() as { accounts?: Record<string, unknown> } | null)
      ?.accounts ?? {},
  );
  const result: PortfolioWarning[] = [];
  function visit(node: unknown, path: string) {
    if (!isMap(node)) return;
    for (const pair of node.items) {
      const id = String(isScalar(pair.key) ? pair.key.value : pair.key);
      if (!isMap(pair.value)) continue;
      const allocations = pair.value.get("allocations", true);
      if (isMap(allocations))
        for (const a of allocations.items) {
          const account = String(isScalar(a.key) ? a.key.value : a.key);
          if (!names.includes(account))
            result.push({
              file: "portfolio",
              kind: "account-undeclared",
              severity: "warning",
              location: `${path}/${pointer(id)}/allocations/${pointer(account)}`,
              message: `Account "${account}" allocated to "${id}" is not declared in accounts.yml.`,
              details: { item: id, account },
            });
        }
      visit(pair.value.get("items", true), `${path}/${pointer(id)}/items`);
    }
  }
  visit(doc.get("items", true), "/items");
  return result;
}
