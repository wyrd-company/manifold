// ---
// relationships:
//   implements: operator-console
// ---
import { parse } from "yaml";
import type { UsageAccount, UsageProvider } from "@wyrd-company/manifold-shared";
export type AccountRow = Omit<UsageAccount, "usage"> & {
  name: string;
  archived: boolean;
  usage: readonly { environment: string; provider: UsageProvider; instance?: string }[];
  providers: readonly UsageProvider[];
};
export function accountRows(text: string): AccountRow[] {
  const document = parse(text) as { accounts?: Record<string, UsageAccount> } | null;
  return Object.entries(document?.accounts ?? {}).map(([name, account]) => ({
    ...account,
    name,
    archived: account.archived ?? false,
    usage: account.usage ?? [],
    providers: [...new Set((account.usage ?? []).map((entry) => entry.provider))],
  }));
}
export function usedBy(
  rows: readonly AccountRow[],
  entry: { account: string; environment: string; provider: UsageProvider; instance?: string },
): string | undefined {
  return rows.find(
    (row) =>
      row.name !== entry.account &&
      !row.archived &&
      row.usage.some(
        (usage) =>
          usage.environment === entry.environment &&
          usage.provider === entry.provider &&
          usage.instance === entry.instance,
      ),
  )?.name;
}
