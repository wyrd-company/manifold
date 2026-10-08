// ---
// relationships:
//   implements: [actor-host, blueprint-migration]
// ---
import type { Snapshot } from "xstate";
import type { LoadedBlueprint } from "../blueprint-loader/index.ts";
import type { PersistedSnapshot, StateValue } from "../store/index.ts";
import type { EntryRecords } from "./records.ts";
import { nodesOf } from "./records.ts";
import type { HeldToken, MigrationFailure } from "./types.ts";
const record = (value: unknown) => value as Record<string, unknown>;
export function prepareMigration(
  snapshot: PersistedSnapshot,
  to: LoadedBlueprint,
  children: ReadonlyMap<string, LoadedBlueprint>,
  tokens: readonly HeldToken[],
  now: number,
) {
  const fail = (
    kind: MigrationFailure["kind"],
    message: string,
    detail: MigrationFailure["detail"] = {},
  ) => ({ ok: false as const, kind, message, detail });
  const { entries, ...raw } = structuredClone(snapshot);
  const check = to.checkRestore(raw as Snapshot<unknown>);
  if (!check.ok)
    return fail("restore-mismatch", "Target cannot restore the saved state", {
      mismatches: JSON.parse(JSON.stringify(check.mismatches)),
    });
  function paths(value: StateValue, prefix = ""): string[] {
    if (typeof value === "string") return [prefix ? `${prefix}.${value}` : value];
    return Object.entries(value).flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return [path, ...paths(child, path)];
    });
  }
  const active = paths(record(raw)["value"] as StateValue);
  for (const token of tokens) {
    const statePath = token.gate.slice(token.gate.lastIndexOf("#") + 1);
    const gate = to.tokens.gates.find((gate) => gate.statePath === statePath);
    if (!gate) return fail("gate-missing", "Target does not declare the held gate", { ...token });
    const node = nodesOf(to.machine).find((node) => node.path.join(".") === statePath)!;
    const returnPoint = record(node.meta!["gate"])["return"];
    if (
      returnPoint === "exit"
        ? !active.includes(statePath)
        : active.includes(String(record(returnPoint)["state"]))
    )
      return fail("token-return", "Migration would return a held token", {
        ...token,
        returnPoint: JSON.parse(JSON.stringify(returnPoint)),
      });
    const configuration = to.tokens.configurationKey(raw as Snapshot<unknown>);
    if (gate.verdict !== "unknown" && gate.traps?.has(configuration))
      return fail("token-trap", "Target traps the held token", { ...token, configuration });
  }
  let rootPath: number | undefined;
  function map(
    saved: Record<string, unknown>,
    blueprint: LoadedBlueprint,
    prefix: string,
  ): ReturnType<typeof fail> | undefined {
    const mapped = blueprint.migrateContext(record(saved["context"]));
    if (!mapped.ok)
      return fail(mapped.kind, mapped.error?.message ?? "No migration path accepts the context", {
        ...(mapped.path === undefined ? {} : { path: mapped.path }),
        ...(mapped.error ? { error: JSON.parse(JSON.stringify(mapped.error)) } : {}),
        ...(mapped.schemaErrors
          ? { schemaErrors: JSON.parse(JSON.stringify(mapped.schemaErrors)) }
          : {}),
      });
    const identity = record(saved["context"])["manifold"];
    saved["context"] = {
      ...mapped.context,
      ...(identity === undefined ? {} : { manifold: identity }),
    };
    if (!prefix) rootPath = mapped.path;
    for (const [id, value] of Object.entries(record(saved["children"] ?? {}))) {
      const key = `${prefix}${encodeURIComponent(id).replaceAll(".", "%2E").replaceAll("#", "%23")}#`;
      const child = children.get(key);
      if (child) {
        const failure = map(record(record(value)["snapshot"]), child, key);
        if (failure) return failure;
      }
    }
    return undefined;
  }
  const failure = map(record(raw), to, "");
  if (failure) return failure;
  const nextEntries = entries as EntryRecords;
  for (const [path, entry] of Object.entries(nextEntries.states)) {
    const separator = path.lastIndexOf("#"),
      prefix = separator === -1 ? "" : path.slice(0, separator + 1);
    const blueprint = prefix ? children.get(prefix)! : to;
    const node = nodesOf(blueprint.machine).find(
      (node) => node.path.join(".") === path.slice(separator + 1),
    )!;
    const after = node.config.after ?? {};
    entry.deadlines = Object.fromEntries(
      Object.entries(entry.deadlines).filter(([key]) => Object.hasOwn(after, key)),
    );
    for (const key of Object.keys(after))
      if (/^\d+$/.test(key) && !Object.hasOwn(entry.deadlines, key))
        entry.deadlines[key] = now + Number(key);
  }
  return {
    ok: true as const,
    snapshot: { ...raw, entries: nextEntries } as PersistedSnapshot,
    path: rootPath,
  };
}
