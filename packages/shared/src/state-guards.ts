// ---
// relationships:
//   implements: [blueprint, token-lint]
// ---
import { and, createMachine, stateIn } from "xstate";
import type { MachineConfig } from "xstate";
import { record } from "./expression-sites.ts";
export class StateGuardError extends Error {
  readonly location: string;
  constructor(location: string, statePath: string) {
    super(`Unknown state path: ${statePath}`);
    this.location = location;
  }
}
export function compileStateGuards(config: Record<string, unknown>): Record<string, unknown> {
  const machine = createMachine(config as MachineConfig<Record<string, unknown>, { type: string }>);
  function transitions(value: unknown, location: string): unknown {
    if (Array.isArray(value))
      return value.map((row, index) => transitions(row, `${location}/${index}`));
    if (value === null || typeof value !== "object") return value;
    const row = record(value),
      guard = record(row["guard"]);
    if (guard["type"] !== "in") return value;
    const paths = record(guard["params"])["states"] as string[];
    return {
      ...row,
      guard: and(
        paths.map((path, index) => {
          let node = machine.root;
          for (const part of path.split(".")) {
            const child = node.states[part];
            if (!child) throw new StateGuardError(`${location}/guard/params/states/${index}`, path);
            node = child;
          }
          return stateIn(`#${node.id.replaceAll("\\", "\\\\").replaceAll(".", "\\.")}`);
        }),
      ),
    };
  }
  const pointer = (key: string) => key.replaceAll("~", "~0").replaceAll("/", "~1");
  function state(source: Record<string, unknown>, location: string): Record<string, unknown> {
    const copy = { ...source };
    for (const key of ["always", "onDone"])
      if (source[key] !== undefined) copy[key] = transitions(source[key], `${location}/${key}`);
    for (const key of ["on", "after"])
      if (source[key] !== undefined)
        copy[key] = Object.fromEntries(
          Object.entries(record(source[key])).map(([event, row]) => [
            event,
            transitions(row, `${location}/${key}/${pointer(event)}`),
          ]),
        );
    if (source["invoke"] !== undefined) {
      const invoke = (value: unknown, at: string) => {
        const row = record(value);
        return {
          ...row,
          ...Object.fromEntries(
            ["onDone", "onError", "onSnapshot"]
              .filter((key) => row[key] !== undefined)
              .map((key) => [key, transitions(row[key], `${at}/${key}`)]),
          ),
        };
      };
      copy["invoke"] = Array.isArray(source["invoke"])
        ? source["invoke"].map((row, index) => invoke(row, `${location}/invoke/${index}`))
        : invoke(source["invoke"], `${location}/invoke`);
    }
    if (source["states"] !== undefined)
      copy["states"] = Object.fromEntries(
        Object.entries(record(source["states"])).map(([key, child]) => [
          key,
          state(record(child), `${location}/states/${pointer(key)}`),
        ]),
      );
    return copy;
  }
  return state(config, "/machine");
}
