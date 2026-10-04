// ---
// relationships:
//   implements: blueprint-loader
// ---
import { setup, enqueueActions } from "xstate";
import type { AnyActorLogic, AnyActorRef, AnyStateMachine, Snapshot } from "xstate";
import { blueprintVersionKey, lintBlueprint, ExpressionError, compileStateGuards } from "@wyrd-company/manifold-shared";
import type {
  TokenLintResult,
  BlueprintDocument,
  BlueprintFinding,
  BlueprintVersion,
  ImplementationNames,
  ProcessRepositoryRevision,
} from "@wyrd-company/manifold-shared";
import { createBlueprintExpressions } from "../blueprint-expressions.ts";
import { bindChildren } from "./children.ts";
import { checkRestore } from "./restore-check.ts";
import type { RestoreCheck } from "./restore-check.ts";

type SetupImplementations = Parameters<
  typeof setup<
    Record<string, unknown>,
    { type: string; [key: string]: unknown },
    Record<string, AnyActorLogic>,
    {},
    Record<string, Record<string, unknown>>,
    Record<string, Record<string, unknown>>,
    string
  >
>[0];
export interface ImplementationRegistry {
  readonly raises?: Readonly<Record<string, readonly string[]>>;
  readonly actors: Readonly<Record<string, AnyActorLogic>>;
  readonly actions: Readonly<Record<string, unknown>>;
  readonly guards: Readonly<Record<string, unknown>>;
  readonly delays: Readonly<Record<string, unknown>>;
}
export interface StateEntry {
  readonly actor: AnyActorRef;
  readonly statePath: string;
}
export interface BlueprintLoaderOptions {
  readonly onStateEntry?: (entry: StateEntry) => void;
  readonly implementations: ImplementationRegistry;
  readonly configurationBound?: number;
  revisionAt(commit: string): Promise<ProcessRepositoryRevision | undefined>;
  onExpressionError(error: ExpressionError, version: BlueprintVersion): void;
}
export interface LoadedBlueprint {
  readonly version: BlueprintVersion;
  readonly key: string;
  readonly document: BlueprintDocument;
  readonly machine: AnyStateMachine;
  readonly warnings: readonly BlueprintFinding[];
  readonly tokens: TokenLintResult;
  checkRestore(snapshot: Snapshot<unknown>): RestoreCheck;
}
export type VersionLoad =
  | { readonly status: "loaded"; readonly blueprint: LoadedBlueprint }
  | { readonly status: "invalid"; readonly findings: readonly BlueprintFinding[] }
  | { readonly status: "missing"; readonly reason: "commit" | "file" };
export interface RevisionLoad {
  readonly commit: string;
  readonly blueprints: ReadonlyMap<string, LoadedBlueprint>;
  readonly failures: ReadonlyMap<string, readonly BlueprintFinding[]>;
}
export interface BlueprintLoader {
  loadRevision(revision: ProcessRepositoryRevision): Promise<RevisionLoad>;
  version(version: BlueprintVersion): Promise<VersionLoad>;
}

function compareBlueprintPaths(left: string, right: string) {
  const a = Array.from(left, (char) => char.codePointAt(0)!),
    b = Array.from(right, (char) => char.codePointAt(0)!);
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const difference = a[index]! - b[index]!;
    if (difference) return difference;
  }
  return a.length - b.length;
}

export function createBlueprintLoader(options: BlueprintLoaderOptions): BlueprintLoader {
  const implementations = options.implementations;
  for (const entries of Object.values(implementations))
    for (const name of Object.keys(entries)) {
      if (
        name.startsWith("expression.") ||
        (entries === implementations.actors && name.startsWith("blueprints/"))
      )
        throw new TypeError(`Reserved implementation name: ${name}`);
    }
  if (Object.hasOwn(implementations.guards, "in"))
    throw new TypeError("Reserved implementation name: in");
  const names: ImplementationNames = {
    ...(implementations.raises === undefined
      ? {}
      : { raises: new Map(Object.entries(implementations.raises)) }),
    actors: new Set(Object.keys(implementations.actors)),
    actions: new Set(Object.keys(implementations.actions)),
    guards: new Set(Object.keys(implementations.guards)),
    delays: new Set(Object.keys(implementations.delays)),
  };
  const cache = new Map<string, Promise<VersionLoad>>();
  async function build(
    version: BlueprintVersion,
    revision?: ProcessRepositoryRevision,
  ): Promise<VersionLoad> {
    const source = revision ?? (await options.revisionAt(version.commit));
    if (!source) return { status: "missing", reason: "commit" };
    const text = await source.read(version.path);
    if (text === undefined) return { status: "missing", reason: "file" };
    const lint = await lintBlueprint(
      version.path,
      text,
      names,
      options.configurationBound === undefined
        ? {}
        : { configurationBound: options.configurationBound },
    );
    if (!lint.ok) return { status: "invalid", findings: lint.findings };
    try {
      const expressions = createBlueprintExpressions(lint.blueprint, {
        onError: (error) => options.onExpressionError(error, version),
      });
      const children = await bindChildren(lint.blueprint, version, source, load);
      function observe(node: Record<string, unknown>, statePath: string) {
        const own =
          node["entry"] === undefined
            ? []
            : Array.isArray(node["entry"])
              ? node["entry"]
              : [node["entry"]];
        node["entry"] = [
          enqueueActions(({ self }) => options.onStateEntry?.({ actor: self, statePath })),
          ...own,
        ];
        for (const [key, child] of Object.entries(
          (node["states"] ?? {}) as Record<string, Record<string, unknown>>,
        ))
          observe(child, statePath ? `${statePath}.${key}` : key);
      }
      observe(expressions.machine as Record<string, unknown>, "");
      const bound = setup({
        actors: { ...implementations.actors, ...children },
        delays: implementations.delays as NonNullable<SetupImplementations["delays"]>,
        guards: {
          ...(implementations.guards as NonNullable<SetupImplementations["guards"]>),
          ...expressions.guards,
        },
        actions: {
          ...(implementations.actions as NonNullable<SetupImplementations["actions"]>),
          ...expressions.actions,
        },
      });
      // The shared lint validates the serializable config; expressions bind its function sites.
      const machine = bound.createMachine(
        compileStateGuards(expressions.machine) as unknown as Parameters<
          typeof bound.createMachine
        >[0],
      );
      return {
        status: "loaded",
        blueprint: {
          version,
          key: blueprintVersionKey(version),
          document: lint.blueprint,
          machine,
          warnings: lint.warnings,
          tokens: lint.tokens,
          checkRestore: (snapshot) => checkRestore(machine, snapshot),
        },
      };
    } catch (error) {
      const finding: BlueprintFinding =
        error instanceof ExpressionError
          ? { ...error.detail, path: version.path, location: `/machine${error.detail.location}` }
          : {
              path: version.path,
              kind: "machine",
              location: "/machine",
              message: error instanceof Error ? error.message : String(error),
            };
      return { status: "invalid", findings: [finding] };
    }
  }
  function load(
    version: BlueprintVersion,
    revision?: ProcessRepositoryRevision,
  ): Promise<VersionLoad> {
    const identity = { ...version },
      key = blueprintVersionKey(identity);
    let promise = cache.get(key);
    if (!promise) {
      promise = build(identity, revision).then(
        (result) => {
          if (result.status === "missing") cache.delete(key);
          return result;
        },
        (error) => {
          cache.delete(key);
          throw error;
        },
      );
      cache.set(key, promise);
    }
    return promise;
  }
  return {
    version: (version) => load(version),
    async loadRevision(revision) {
      const blueprints = new Map<string, LoadedBlueprint>(),
        failures = new Map<string, readonly BlueprintFinding[]>();
      const paths = [...new Set(await revision.list("blueprints"))]
        .filter((path) => /\.ya?ml$/.test(path))
        .sort(compareBlueprintPaths);
      for (const path of paths) {
        const result = await load({ commit: revision.commit, path }, revision);
        if (result.status === "loaded") blueprints.set(path, result.blueprint);
        else if (result.status === "invalid") failures.set(path, result.findings);
      }
      return { commit: revision.commit, blueprints, failures };
    },
  };
}
