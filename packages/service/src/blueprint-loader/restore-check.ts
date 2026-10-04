// ---
// relationships:
//   implements: [blueprint-loader, durable-event-delivery]
// ---
import type { AnyStateMachine, Snapshot } from "xstate";
export type RestoreCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly mismatches: readonly RestoreMismatch[] };
export type RestoreMismatch =
  | { readonly kind: "state-missing"; readonly statePath: string }
  | { readonly kind: "state-incomplete"; readonly statePath: string }
  | { readonly kind: "history-missing"; readonly stateId: string }
  | { readonly kind: "child-missing"; readonly childId: string }
  | { readonly kind: "implementation-missing"; readonly childId: string; readonly src: string };
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
type Node = AnyStateMachine["root"];

export function checkRestore(machine: AnyStateMachine, snapshot: Snapshot<unknown>): RestoreCheck {
  const states: RestoreMismatch[] = [],
    history: RestoreMismatch[] = [],
    children: RestoreMismatch[] = [],
    implementations: RestoreMismatch[] = [];
  function check(machine: AnyStateMachine, snapshot: unknown, prefix: string) {
    const saved = record(snapshot),
      active = new Set<Node>();
    const join = (path: string) => [prefix, path].filter(Boolean).join(".");
    function state(node: Node, value: unknown, path: string) {
      active.add(node);
      const keys = typeof value === "string" ? [value] : Object.keys(record(value));
      const regions = Object.keys(node.states).filter(
        (key) => node.states[key]!.type !== "history",
      );
      if (
        (node.type === "compound" && keys.length === 0) ||
        (node.type === "parallel" && regions.some((key) => !keys.includes(key)))
      )
        states.push({ kind: "state-incomplete", statePath: join(path) });
      for (const key of keys.sort()) {
        const child = Object.hasOwn(node.states, key) ? node.states[key] : undefined,
          childPath = [path, key].filter(Boolean).join(".");
        if (!child) states.push({ kind: "state-missing", statePath: join(childPath) });
        else state(child, typeof value === "string" ? undefined : record(value)[key], childPath);
      }
    }
    state(machine.root, saved["value"], "");
    const ids = new Set<string>();
    function collect(node: Node) {
      ids.add(node.id);
      for (const child of Object.values(node.states)) collect(child);
    }
    collect(machine.root);
    const historyIds = new Set<string>();
    for (const [key, value] of Object.entries(record(saved["historyValue"]))) {
      historyIds.add(key);
      for (const entry of Array.isArray(value) ? value : []) {
        const id = typeof entry === "string" ? entry : record(entry)["id"];
        if (typeof id === "string") historyIds.add(id);
      }
    }
    for (const id of [...historyIds].sort())
      if (!ids.has(id)) history.push({ kind: "history-missing", stateId: join(id) });
    const invokes = [...active].flatMap((node) => node.invoke);
    for (const [id, value] of Object.entries(record(saved["children"])).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    )) {
      const child = record(value),
        src = child["src"],
        childId = join(id);
      if (!invokes.some((invoke) => invoke.id === id && invoke.src === src))
        children.push({ kind: "child-missing", childId });
      const logic =
        typeof src === "string" && Object.hasOwn(machine.implementations.actors, src)
          ? machine.implementations.actors[src]
          : undefined;
      if (!logic)
        implementations.push({
          kind: "implementation-missing",
          childId,
          src: typeof src === "string" ? src : String(src),
        });
      else if ("root" in logic && record(child["snapshot"])["value"] !== undefined)
        check(logic as AnyStateMachine, child["snapshot"], childId);
    }
  }
  check(machine, snapshot, "");
  const mismatches = [...states, ...history, ...children, ...implementations];
  return mismatches.length ? { ok: false, mismatches } : { ok: true };
}
