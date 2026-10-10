// ---
// relationships:
//   implements: token-lint
// ---
import type { AnyStateMachine, Snapshot, StateValue } from "xstate";
import { record } from "../expression-sites.ts";
export function compareCodePoints(a: string, b: string) {
  const left = Array.from(a, (char) => char.codePointAt(0)!),
    right = Array.from(b, (char) => char.codePointAt(0)!);
  for (let index = 0; index < Math.min(left.length, right.length); index++)
    if (left[index] !== right[index]) return left[index]! - right[index]!;
  return left.length - right.length;
}
export function configurationKey(machine: AnyStateMachine, snapshot: Snapshot<unknown>): string {
  const saved = snapshot as Snapshot<unknown> & {
    value: StateValue;
    historyValue?: Record<string, readonly { id: string }[]>;
  };
  const resolved = machine.resolveState({ value: saved.value, context: {} });
  const states = resolved._nodes.map((node) => node.id).sort(compareCodePoints);
  const history = Object.entries(record(saved.historyValue))
    .map(
      ([id, nodes]) =>
        [
          id,
          (nodes as readonly { id: string }[]).map((node) => node.id).sort(compareCodePoints),
        ] as const,
    )
    .sort(([a], [b]) => compareCodePoints(a, b));
  return JSON.stringify([states, history, saved.status]);
}
