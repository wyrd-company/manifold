// ---
// relationships:
//   implements: blueprint-loader
// ---
import { isDeepStrictEqual } from "node:util";
import { parse } from "yaml";
import { fromPromise } from "xstate";
import type { AnyActorLogic } from "xstate";
import type {
  BlueprintDocument,
  BlueprintVersion,
  ProcessRepositoryRevision,
} from "@wyrd-company/manifold-shared";
import type { VersionLoad } from "./loader.ts";

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
export function childPaths(machine: Record<string, unknown>): string[] {
  const paths = new Set<string>();
  function walk(node: Record<string, unknown>) {
    for (const invoke of node["invoke"] === undefined
      ? []
      : Array.isArray(node["invoke"])
        ? node["invoke"]
        : [node["invoke"]]) {
      const src = record(invoke)["src"];
      if (typeof src === "string" && src.startsWith("blueprints/")) paths.add(src);
    }
    for (const child of Object.values(record(node["states"]))) walk(record(child));
  }
  walk(machine);
  return [...paths].sort();
}
export const unavailableChildren = new WeakSet<object>();
export async function bindChildren(
  document: BlueprintDocument,
  version: BlueprintVersion,
  revision: ProcessRepositoryRevision,
  load: (version: BlueprintVersion, revision: ProcessRepositoryRevision) => Promise<VersionLoad>,
  bundledFiles?: ReadonlyMap<string, string>,
) {
  async function reaches(path: string, visited: Set<string>): Promise<boolean> {
    if (path === version.path) return true;
    if (visited.has(path)) return false;
    visited.add(path);
    const text = bundledFiles ? bundledFiles.get(path) : await revision.read(path);
    if (text === undefined) return false;
    let machine;
    try {
      machine = record(record(parse(text))["machine"]);
    } catch {
      return false;
    }
    for (const child of childPaths(machine)) if (await reaches(child, visited)) return true;
    return false;
  }
  const actors: Record<string, AnyActorLogic> = {};
  for (const path of childPaths(document.machine)) {
    let error: Record<string, unknown> | undefined;
    if (await reaches(path, new Set())) error = { type: "child-blueprint", path, reason: "cycle" };
    else {
      const result = await load(
        { commit: version.commit, path, ...(version.bundle ? { bundle: version.bundle } : {}) },
        revision,
      );
      if (result.status !== "loaded")
        error = {
          type: "child-blueprint",
          path,
          reason: result.status,
          ...(result.status === "invalid" ? { findings: result.findings } : {}),
        };
      else {
        const boundary = document.schemas.actors?.[path];
        if (
          boundary &&
          (["input", "output"] as const).some(
            (key) => !isDeepStrictEqual(boundary[key], result.blueprint.document.schemas[key]),
          )
        )
          error = { type: "child-blueprint", path, reason: "schemas" };
        else actors[path] = result.blueprint.machine;
      }
    }
    if (error) {
      const failure = error;
      actors[path] = fromPromise(async () => {
        throw failure;
      });
      unavailableChildren.add(actors[path]!);
    }
  }
  return actors;
}
