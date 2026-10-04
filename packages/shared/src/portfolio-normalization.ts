// ---
// relationships:
//   implements: portfolio-declaration
// ---
import type { LedgerPortfolioInput } from "./ledger-portfolio.ts";
import type {
  ItemDocument,
  PortfolioDocument,
  PortfolioDeclaration,
  PortfolioFinding,
} from "./portfolio-declaration-types.ts";
export const pointerSegment = (value: string) => value.replaceAll("~", "~0").replaceAll("/", "~1");

export function normalizePortfolio(document: PortfolioDocument, findings: PortfolioFinding[]) {
  const items: PortfolioDeclaration["items"][number][] = [];
  const allocations: LedgerPortfolioInput["allocations"] = [];
  const rows: { row: LedgerPortfolioInput["allocations"][number]; location: string }[] = [];
  const itemLocations = new Map<string, string>();
  function add(
    id: string,
    parent: string | null,
    entry: ItemDocument,
    archived: boolean,
    other: boolean,
    location: string,
  ) {
    items.push({ id, parent, title: other ? "Other" : (entry.title ?? id), archived, other });
    if (archived) return;
    for (const [account, allocation] of Object.entries(entry.allocations ?? {})) {
      const row = { ...allocation, item: id, account, guarantee: allocation.guarantee ?? 0 };
      allocations.push(row);
      rows.push({ row, location: `${location}/allocations/${pointerSegment(account)}` });
    }
  }
  function visit(
    entries: Record<string, ItemDocument>,
    parent: string | null,
    inheritedArchive: boolean,
    location: string,
  ) {
    const declared = Object.entries(entries).filter(([id]) => id !== "other");
    for (const [id, entry] of declared) {
      const path = `${location}/${pointerSegment(id)}`;
      if (itemLocations.has(id)) {
        findings.push({
          file: "portfolio",
          kind: "duplicate-item",
          location: path,
          message: `Duplicate item "${id}".`,
        });
      } else itemLocations.set(id, path);
      const archived = inheritedArchive || (entry.archived ?? false);
      add(id, parent, entry, archived, false, path);
      visit(entry.items ?? {}, id, archived, `${path}/items`);
    }
    if (parent === null || declared.length > 0)
      add(
        parent === null ? "other" : `${parent}/other`,
        parent,
        entries["other"] ?? {},
        inheritedArchive,
        true,
        `${location}/other`,
      );
    else if (entries["other"] !== undefined)
      findings.push({
        file: "portfolio",
        kind: "other-without-items",
        location: `${location}/other`,
        message: `Other under "${parent}" requires a sub-item.`,
      });
  }
  visit(document.items ?? {}, null, false, "/items");
  return {
    declaration: {
      ledger: {
        items: items.map(({ id, parent, archived }) => ({ id, parent, archived })),
        allocations,
      },
      items,
    },
    rows,
    itemLocations,
  };
}
