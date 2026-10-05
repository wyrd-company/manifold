// ---
// relationships:
//   implements: operator-console
// ---
import { parseDocument, isMap, isScalar } from "yaml";
import type {
  PortfolioResponse,
  PortfolioItem,
  PortfolioAllocation,
} from "@wyrd-company/manifold-shared/portfolio-api";
export function draftRead(read: PortfolioResponse, text: string): PortfolioResponse {
  const doc = parseDocument(text);
  if (doc.errors.length) return read;
  const items: PortfolioItem[] = [];
  function level(node: unknown, parent: string | null) {
    if (!isMap(node)) return;
    for (const pair of node.items) {
      if (!isMap(pair.value)) continue;
      const key = String(isScalar(pair.key) ? pair.key.value : pair.key),
        id = key === "other" ? (parent ? `${parent}/other` : "other") : key,
        old = read.items.find((i) => i.id === id);
      const allocations = pair.value.get("allocations", true);
      const names = [
        ...new Set([
          ...read.accounts.map((a) => a.name),
          ...(isMap(allocations)
            ? allocations.items.map((a) => String(isScalar(a.key) ? a.key.value : a.key))
            : []),
        ]),
      ];
      const rows: PortfolioAllocation[] = names.map((account) => {
        const row = isMap(allocations) ? allocations.get(account, true) : undefined,
          prior = old?.allocations.find((a) => a.account === account);
        const n = (key: string) =>
          isMap(row) && typeof row.get(key) === "number" ? (row.get(key) as number) : undefined;
        const pacing = isMap(row) ? row.get("pacing", true) : undefined;
        return {
          account,
          declared: isMap(row),
          guarantee: n("guarantee") ?? 0,
          ...(n("ceiling") !== undefined ? { ceiling: n("ceiling")! } : {}),
          ...(n("weight") !== undefined ? { weight: n("weight")! } : {}),
          ...(isMap(pacing) ? { pacing: { burst: Number(pacing.get("burst") ?? 0) } } : {}),
          amount: prior?.amount ?? 0,
          actual: prior?.actual ?? 0,
          outstanding: prior?.outstanding ?? 0,
          available: prior?.available ?? 0,
          reservable: prior?.reservable ?? 0,
          lifetime: prior?.lifetime ?? 0,
        };
      });
      const children = pair.value.get("items", true);
      items.push({
        id,
        parent,
        title: String(pair.value.get("title") ?? (key === "other" ? "Other" : id)),
        other: key === "other",
        archived:
          pair.value.get("archived") === true || !!items.find((i) => i.id === parent)?.archived,
        projects: old?.projects ?? { github: [], t3code: [] },
        activeTasks: old?.activeTasks ?? 0,
        allocations: rows,
        ...(isMap(children) ? { unallocated: old?.unallocated ?? [] } : {}),
      });
      level(children, id);
    }
  }
  level(doc.get("items", true), null);
  // Other is implicit where the declaration has no explicit Other row.
  for (const item of read.items.filter((i) => i.other)) {
    if (
      !items.some((i) => i.id === item.id) &&
      (!item.parent || items.some((i) => i.id === item.parent))
    )
      items.push(item);
  }
  return { ...read, items };
}
