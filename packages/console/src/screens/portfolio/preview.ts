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
      items.push({
        ...item,
        allocations: item.allocations.map((a) => ({
          account: a.account,
          declared: false,
          guarantee: 0,
          amount: 0,
          actual: a.actual,
          outstanding: a.outstanding,
          available: a.available,
          reservable: a.reservable,
          lifetime: a.lifetime,
        })),
      });
  }
  function amounts(parent: string | null, account: string, capacity: number) {
    for (const item of items.filter((i) => i.parent === parent && !i.archived)) {
      const row = item.allocations.find((a) => a.account === account);
      if (!row) continue;
      const amount = Number((BigInt(capacity) * BigInt(Math.round(row.guarantee * 100))) / 10000n);
      Object.assign(row, { amount });
      amounts(item.id, account, amount);
    }
  }
  for (const account of read.accounts) amounts(null, account.name, account.window?.capacity ?? 0);
  function remainder(parent: string | null) {
    return read.accounts.map((account) => {
      const children = items
        .filter((i) => i.parent === parent && !i.archived)
        .map((i) => i.allocations.find((a) => a.account === account.name));
      const capacity =
        parent === null
          ? (account.window?.capacity ?? 0)
          : (items.find((i) => i.id === parent)?.allocations.find((a) => a.account === account.name)
              ?.amount ?? 0);
      return {
        account: account.name,
        percent: Number(
          (100 - children.reduce((sum, a) => sum + (a?.guarantee ?? 0), 0)).toFixed(2),
        ),
        amount: capacity - children.reduce((sum, a) => sum + (a?.amount ?? 0), 0),
      };
    });
  }
  for (const item of items)
    if (item.unallocated) Object.assign(item, { unallocated: remainder(item.id) });
  return { ...read, items, unallocated: remainder(null) };
}

export function changedGuaranteeParents(
  base: PortfolioResponse,
  next: PortfolioResponse,
  account: string,
): (string | null)[] {
  const parents = new Set<string | null>();
  const guarantee = (item: PortfolioItem | undefined) =>
    item && !item.archived
      ? (item.allocations.find((a) => a.account === account)?.guarantee ?? 0)
      : 0;
  for (const id of new Set([...next.items, ...base.items].map((i) => i.id))) {
    const before = base.items.find((i) => i.id === id),
      after = next.items.find((i) => i.id === id);
    if (guarantee(before) !== guarantee(after))
      parents.add(after?.parent ?? before?.parent ?? null);
  }
  return [...parents];
}
