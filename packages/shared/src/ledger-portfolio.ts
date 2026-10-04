// ---
// relationships:
//   implements: portfolio-ledger
// ---
export type LedgerPortfolioInput = {
  items: { id: string; parent: string | null; archived?: boolean }[];
  allocations: {
    item: string;
    account: string;
    guarantee: number;
    ceiling?: number;
    weight?: number;
    pacing?: { burst: number };
  }[];
};
export type LedgerErrorCode =
  | "invalid-portfolio"
  | "guarantee-limit"
  | "invalid-input"
  | "idempotency-conflict"
  | "actor-settled"
  | "no-window"
  | "window-conflict";
export class LedgerError extends Error {
  readonly code: LedgerErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(
    code: LedgerErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "LedgerError";
    this.code = code;
    this.details = details;
  }
}
const portfolioBrand: unique symbol = Symbol("LedgerPortfolio");
type Allocation = { guarantee: bigint; ceiling: bigint; weight: bigint; burst: bigint | null };
export type PortfolioItem = {
  readonly id: string;
  readonly parent: string | null;
  readonly archived: boolean;
};
type PortfolioData = {
  readonly items: ReadonlyMap<string, PortfolioItem>;
  readonly children: ReadonlyMap<string | null, readonly string[]>;
  readonly allocations: ReadonlyMap<string, ReadonlyMap<string, Allocation>>;
};
export type LedgerPortfolio = { readonly [portfolioBrand]: PortfolioData };
export const portfolioData = (portfolio: LedgerPortfolio) => portfolio[portfolioBrand];
function invalid(message: string, details: Record<string, unknown>): never {
  throw new LedgerError("invalid-portfolio", message, details);
}
function identifier(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !value.trim())
    invalid(`Invalid ${field}: ${String(value)}.`, { [field]: value });
}
function percent(value: number, field: string) {
  const rounded = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || value > 100 || value !== rounded / 100)
    invalid(`Invalid ${field}: ${value}.`, { [field]: value });
  return BigInt(rounded);
}
export function parseLedgerPortfolio(input: LedgerPortfolioInput): LedgerPortfolio {
  if (!input || !Array.isArray(input.items) || !Array.isArray(input.allocations))
    invalid("Expected portfolio items and allocations.", { input });
  const items = new Map<string, PortfolioItem>();
  const children = new Map<string | null, string[]>();
  for (const item of input.items) {
    if (!item || typeof item !== "object") invalid("Invalid portfolio item.", { item });
    identifier(item.id, "item");
    if (items.has(item.id)) invalid(`Duplicate item "${item.id}".`, { item: item.id });
    if (item.parent !== null) identifier(item.parent, "parent");
    if (item.archived !== undefined && typeof item.archived !== "boolean")
      invalid(`Invalid archived flag on "${item.id}".`, { item: item.id });
    items.set(
      item.id,
      Object.freeze({ id: item.id, parent: item.parent, archived: item.archived ?? false }),
    );
    const siblings = children.get(item.parent) ?? [];
    siblings.push(item.id);
    children.set(item.parent, siblings);
  }
  for (const item of items.values()) {
    if (item.parent !== null && !items.has(item.parent))
      invalid(`Unknown parent "${item.parent}" of "${item.id}".`, {
        item: item.id,
        parent: item.parent,
      });
    const seen = new Set<string>([item.id]);
    let parent = item.parent;
    while (parent !== null) {
      if (seen.has(parent)) invalid(`Cycle through item "${parent}".`, { item: parent });
      seen.add(parent);
      parent = items.get(parent)!.parent;
    }
    if (item.parent !== null && items.get(item.parent)!.archived && !item.archived)
      invalid(`Live item "${item.id}" under archived parent "${item.parent}".`, {
        item: item.id,
        parent: item.parent,
      });
  }
  const allocations = new Map<string, Map<string, Allocation>>();
  for (const row of input.allocations) {
    if (!row || typeof row !== "object") invalid("Invalid allocation row.", { row });
    identifier(row.account, "account");
    const item = items.get(row.item);
    if (!item || item.archived)
      invalid(`Unknown or archived allocation item "${row.item}".`, { item: row.item });
    const account = allocations.get(row.account) ?? new Map<string, Allocation>();
    if (account.has(row.item))
      invalid(`Duplicate allocation for "${row.item}" on "${row.account}".`, {
        item: row.item,
        account: row.account,
      });
    const guarantee = percent(row.guarantee, "guarantee");
    const ceiling = percent(row.ceiling ?? 100, "ceiling");
    if (ceiling < guarantee)
      invalid(`Ceiling below guarantee for "${row.item}".`, {
        item: row.item,
        ceiling: row.ceiling,
        guarantee: row.guarantee,
      });
    const weight = row.weight ?? 1;
    if (!Number.isSafeInteger(weight) || weight <= 0)
      invalid(`Invalid weight ${weight} for "${row.item}".`, { item: row.item, weight });
    const burst = row.pacing === undefined ? null : percent(row.pacing?.burst, "burst");
    account.set(row.item, Object.freeze({ guarantee, ceiling, weight: BigInt(weight), burst }));
    allocations.set(row.account, account);
  }
  // Top level first, then parents in declaration order.
  for (const parent of [null, ...items.keys()]) {
    for (const [account, rows] of allocations) {
      const sum = (children.get(parent) ?? []).reduce(
        (total, id) => total + (rows.get(id)?.guarantee ?? 0n),
        0n,
      );
      if (sum > 10000n) {
        const percentage = Number(sum) / 100;
        throw new LedgerError(
          "guarantee-limit",
          `Guarantees under ${parent === null ? "the top level" : `"${parent}"`} for account "${account}" total ${percentage}%, above 100%.`,
          { account, parent, sum: percentage },
        );
      }
    }
  }
  return Object.freeze({ [portfolioBrand]: { items, children, allocations } });
}
const defaultAllocation: Allocation = Object.freeze({
  guarantee: 0n,
  ceiling: 10000n,
  weight: 1n,
  burst: null,
});
export function allocationFor(
  portfolio: LedgerPortfolio,
  account: string,
  item: string,
): Allocation {
  return portfolioData(portfolio).allocations.get(account)?.get(item) ?? defaultAllocation;
}
export function itemPath(portfolio: LedgerPortfolio, item: string): string[] {
  const path: string[] = [];
  let current: string | null = item;
  while (current !== null) {
    path.push(current);
    current = portfolioData(portfolio).items.get(current)!.parent;
  }
  return path.toReversed();
}
