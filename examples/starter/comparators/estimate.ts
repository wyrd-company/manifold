// ---
// relationships:
//   implements: [default-process, comparator-contract]
// ---
import type { Comparator } from "manifold:comparator";
const account = "agents";
const defaultEstimate = 1;
const comparator: Comparator = ({ population, balances }) => {
  const oldestFirst = [...population].sort(
    (a, b) => b.age - a.age || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  for (const task of oldestFirst) {
    if (task.dependencies === "blocked") continue;
    const field = task.fields["Estimate"] as { number?: unknown } | null | undefined;
    const dollars =
      typeof field?.number === "number" && field.number > 0 ? field.number : defaultEstimate;
    const amount = Math.max(1, Math.round(dollars * 1_000_000));
    if (amount <= (balances[task.item]?.[account] ?? 0))
      return { task: task.id, reservations: [{ account, amount }] };
  }
  return null;
};
export default comparator;
