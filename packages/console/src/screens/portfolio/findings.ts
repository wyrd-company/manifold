// ---
// relationships:
//   implements: operator-console
// ---
import type { PortfolioFinding } from "@wyrd-company/manifold-shared";
import type { PortfolioItem } from "@wyrd-company/manifold-shared/portfolio-api";
export function inputFinding(
  findings: readonly PortfolioFinding[],
  item: PortfolioItem,
  account: string,
  field: string,
) {
  return findings.find(
    (f) =>
      (f.kind === "guarantee-limit" &&
        field === "guarantee" &&
        f.details?.["parent"] === item.parent &&
        f.details?.["account"] === account) ||
      (f.file === "portfolio" &&
        f.location.endsWith(
          `/allocations/${account}/${field === "burst" ? "pacing/burst" : field}`,
        ) &&
        f.location.split("/allocations/")[0]?.split("/").at(-1) ===
          (item.other ? "other" : item.id) &&
        (!item.other ||
          (f.location.split("/allocations/")[0]?.split("/").at(-3) || null) === item.parent)),
  );
}
