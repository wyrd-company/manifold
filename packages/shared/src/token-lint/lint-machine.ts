// ---
// relationships:
//   implements: token-lint
// ---
import { createMachine, enqueueActions, fromCallback } from "xstate";
import type { MachineConfig } from "xstate";
import type { BlueprintDocument } from "../blueprint-lint.ts";
import { record } from "../expression-sites.ts";
import { compileStateGuards } from "../state-guards.ts";
import { marker } from "./types.ts";
import type { Choice, Gate, TokenLintOptions } from "./types.ts";
const list = (value: unknown): unknown[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];
const pointer = (value: string) => value.replaceAll("~", "~0").replaceAll("/", "~1");
export function lintMachine(document: BlueprintDocument, options: TokenLintOptions, bound: number) {
  const gates: Gate[] = [];
  const configs = new Map<string, Record<string, unknown>>();
  let script: readonly boolean[] = [],
    choices: Choice[] = [];
  function choose(location: string, raises?: string) {
    const value = script[choices.length] ?? false;
    choices.push({ location, ...(raises === undefined ? {} : { raises }), value });
    return value;
  }
  function actions(value: unknown, location: string): unknown[] {
    return list(value).flatMap((action, index) => {
      const name = typeof action === "string" ? action : (record(action)["type"] as string);
      if (name === "expression.assign") return [];
      const at = `${location}${Array.isArray(value) ? `/${index}` : ""}`;
      return [
        enqueueActions(({ enqueue }) => {
          for (const event of options.names.raises?.get(name) ?? [])
            if (choose(at, event)) enqueue.raise({ type: event });
        }),
      ];
    });
  }
  function transitions(value: unknown, location: string): unknown {
    if (value === undefined) return undefined;
    const rows = list(value).map((item, index) => {
      if (typeof item === "string") return item;
      const row = record(item),
        at = `${location}${Array.isArray(value) ? `/${index}` : ""}`;
      return {
        ...row,
        ...(row["guard"] === undefined
          ? {}
          : {
              guard:
                record(row["guard"])["type"] === "in" ? row["guard"] : () => choose(`${at}/guard`),
            }),
        actions: actions(row["actions"], `${at}/actions`),
      };
    });
    return Array.isArray(value) ? rows : rows[0];
  }
  function walk(
    source: Record<string, unknown>,
    path: string,
    location: string,
  ): Record<string, unknown> {
    const config = { ...source };
    configs.set(path, config);
    const gate = record(record(source["meta"])["gate"]);
    if (Object.keys(gate).length)
      gates.push({
        statePath: path,
        location: `${location}/meta/gate`,
        token: (gate["token"] as string) ?? "token",
        ...(gate["return"] === "exit"
          ? {}
          : { returnState: record(gate["return"])["state"] as string }),
      });
    config["entry"] = actions(source["entry"], `${location}/entry`);
    config["exit"] = actions(source["exit"], `${location}/exit`);
    for (const key of ["always", "onDone"])
      config[key] = transitions(source[key], `${location}/${key}`);
    for (const key of ["on", "after"])
      config[key] = Object.fromEntries(
        Object.entries(record(source[key])).map(([event, row]) => [
          event,
          transitions(row, `${location}/${key}/${pointer(event)}`),
        ]),
      );
    config["invoke"] = list(source["invoke"]).map((item, index) => {
      const invoke = record(item),
        at = `${location}/invoke${Array.isArray(source["invoke"]) ? `/${index}` : ""}`;
      return {
        ...invoke,
        src: fromCallback(() => {}),
        input: undefined,
        ...Object.fromEntries(
          ["onDone", "onError", "onSnapshot"].map((key) => [
            key,
            transitions(invoke[key], `${at}/${key}`),
          ]),
        ),
      };
    });
    delete config["output"];
    config["states"] = Object.fromEntries(
      Object.entries(record(source["states"])).map(([key, child]) => [
        key,
        walk(record(child), path ? `${path}.${key}` : key, `${location}/states/${pointer(key)}`),
      ]),
    );
    return config;
  }
  const config = walk(document.machine, "", "/machine");
  config["context"] = {};
  for (const gate of gates) {
    const gated = configs.get(gate.statePath)!;
    (gated["exit"] as unknown[]).push(marker("exit", gate.statePath));
    const returned =
      gate.returnState === undefined ? gated["exit"] : configs.get(gate.returnState)!["entry"];
    (returned as unknown[]).push(marker("return", gate.statePath));
  }
  const delays = Object.fromEntries([...options.names.delays].map((name) => [name, 1]));
  const machine = createMachine(
    compileStateGuards(config) as MachineConfig<Record<string, unknown>, { type: string }>,
    { delays },
  );
  machine.options = { ...machine.options, maxIterations: bound };
  return {
    machine,
    gates,
    run<T>(nextScript: readonly boolean[], step: () => T) {
      script = nextScript;
      choices = [];
      const value = step();
      return { value, choices };
    },
  };
}
