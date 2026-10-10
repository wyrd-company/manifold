// ---
// relationships:
//   implements: operator-console
// ---
import type { DeclarationFinding } from "@wyrd-company/manifold-shared/declarations-api";
import type { PortfolioItem } from "@wyrd-company/manifold-shared/portfolio-api";
export function inputFinding(
  findings: readonly DeclarationFinding[],
  item: PortfolioItem,
  account: string,
  field: string,
) {
  return findings.find((f) => {
    const details = f["details"];
    return (
      (f.kind === "guarantee-limit" &&
        field === "guarantee" &&
        typeof details === "object" &&
        details !== null &&
        "parent" in details &&
        details.parent === item.parent &&
        "account" in details &&
        details.account === account) ||
      (f.file === "portfolio" &&
        f.location.endsWith(
          `/allocations/${account}/${field === "burst" ? "pacing/burst" : field}`,
        ) &&
        f.location.split("/allocations/")[0]?.split("/").at(-1) ===
          (item.other ? "other" : item.id) &&
        (!item.other ||
          (f.location.split("/allocations/")[0]?.split("/").at(-3) || null) === item.parent))
    );
  });
}
