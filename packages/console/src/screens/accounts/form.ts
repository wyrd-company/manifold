// ---
// relationships:
//   implements: operator-console
// ---
import type { UsageProvider } from "@wyrd-company/manifold-shared";
import type { AccountRow } from "./rows.ts";
import type { AccountEdit, AccountValues } from "./edits.ts";
export type AccountForm = {
  kind: "api" | "subscription";
  name: string;
  provider: UsageProvider;
  usage: readonly { environment: string; instances: readonly string[] }[];
  amount: string;
  window:
    | { preset: "monthly" | "weekly" | "daily" }
    | { count: string; unit: "hours" | "days" | "months" };
  reset: string;
};
export function localDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${date.getMilliseconds() ? `.${String(date.getMilliseconds()).padStart(3, "0")}` : ""}`;
}
export function formFor(row: AccountRow | undefined, now: Date): AccountForm {
  const usage: { environment: string; instances: string[] }[] = [];
  for (const entry of row?.usage ?? []) {
    let group = usage.find((group) => group.environment === entry.environment);
    if (!group) {
      group = { environment: entry.environment, instances: [] };
      usage.push(group);
    }
    group.instances.push(entry.instance ?? "");
  }
  const every = row?.capacity.every;
  const window: AccountForm["window"] =
    !every || ("months" in every && every.months === 1)
      ? { preset: "monthly" }
      : "days" in every && every.days === 7
        ? { preset: "weekly" }
        : "days" in every && every.days === 1
          ? { preset: "daily" }
          : {
              count: String(Object.values(every)[0]),
              unit: Object.keys(every)[0] as "hours" | "days" | "months",
            };
  return {
    name: row?.name ?? "",
    kind: row?.kind ?? "api",
    provider: row?.providers[0] ?? "claude",
    usage,
    amount: row ? String(row.capacity.amount) : "",
    window,
    reset: localDateTime(
      row ? new Date(row.capacity.reset) : new Date(now.getFullYear(), now.getMonth(), 1),
    ),
  };
}
export function editFor(
  form: AccountForm,
  row: AccountRow | undefined,
): AccountEdit | { invalid: "amount" | "window" | "reset" } {
  const amount = Number(form.amount);
  if (!form.amount.trim() || !Number.isFinite(amount)) return { invalid: "amount" };
  let every: AccountValues["capacity"]["every"];
  if ("preset" in form.window)
    every =
      form.window.preset === "monthly"
        ? { months: 1 }
        : { days: form.window.preset === "weekly" ? 7 : 1 };
  else {
    const count = Number(form.window.count);
    if (!form.window.count.trim() || !Number.isFinite(count)) return { invalid: "window" };
    every = { [form.window.unit]: count } as AccountValues["capacity"]["every"];
  }
  const resetAt =
    row && form.reset === localDateTime(new Date(row.capacity.reset))
      ? Date.parse(row.capacity.reset)
      : new Date(form.reset).getTime();
  if (!form.reset || !Number.isFinite(resetAt)) return { invalid: "reset" };
  const capacity = {
    amount,
    every,
    reset: new Date(resetAt).toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
  const usage = form.usage.flatMap(({ environment, instances }) =>
    instances.map((instance) => ({
      environment,
      provider: form.provider,
      ...(instance ? { instance } : {}),
    })),
  );
  if (!row) return { kind: "add", name: form.name, account: { kind: form.kind, capacity, usage } };
  const key = (entry: AccountValues["usage"][number]) =>
    JSON.stringify([entry.environment, entry.provider, entry.instance ?? null]);
  const set = (entries: AccountValues["usage"]) =>
    JSON.stringify([...new Set(entries.map(key))].sort());
  const sameCapacity =
    amount === row.capacity.amount &&
    JSON.stringify(every) === JSON.stringify(row.capacity.every) &&
    resetAt === Date.parse(row.capacity.reset);
  return {
    kind: "set",
    name: row.name,
    ...(!sameCapacity ? { capacity } : {}),
    ...(row.providers.length <= 1 && set(usage) !== set(row.usage) ? { usage } : {}),
  };
}
