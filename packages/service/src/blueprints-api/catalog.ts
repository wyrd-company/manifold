// ---
// relationships:
//   implements: blueprints-api
// ---
import {
  lintBlueprint,
  manifoldImplementationNames,
  parseBlueprintVersionKey,
  lintInvokedDecisionModels,
  lintTaskMetadataDeclaration,
  declaredLifecycleOptions,
  declaredTaskFields,
} from "@wyrd-company/manifold-shared";
import type { ModelText } from "@wyrd-company/manifold-shared/declarations-api";
import { overlay } from "../declarations-api/model-files.ts";
import type { BlueprintItem, LintResponse } from "@wyrd-company/manifold-shared/blueprints-api";
import { lintAnswer, listAnswer } from "./answers.ts";
import type { RevisionLoad } from "../blueprint-loader/index.ts";
import type { BlueprintsApiOptions } from "./types.ts";
async function inspectText(
  options: BlueprintsApiOptions,
  path: string,
  text: string,
  base?: string,
  models: readonly ModelText[] = [],
) {
  const commit = base ?? options.revisions.latest()?.commit;
  const revision = commit ? await options.processRepository.revisionAt(commit) : undefined;
  const read = overlay(revision?.read ?? (async () => undefined), models);
  const metadata = lintTaskMetadataDeclaration({
    taskMetadata: await read("task-metadata.yml"),
    bindings: await read("bindings.yml"),
  });
  const lint = await lintBlueprint(path, text, manifoldImplementationNames, {
    configurationBound: options.configurationBound,
    decisionModels: await lintInvokedDecisionModels(read, text),
    ...(metadata.ok
      ? {
          lifecycleOptions: declaredLifecycleOptions(metadata.declaration),
          taskFields: declaredTaskFields(metadata.declaration),
        }
      : {}),
  });
  const response = lintAnswer(text, lint);
  return { response, description: lint.ok ? lint.blueprint.description : undefined };
}
export async function lintText(
  options: BlueprintsApiOptions,
  path: string,
  text: string,
  base?: string,
  models?: readonly ModelText[],
): Promise<LintResponse> {
  return (await inspectText(options, path, text, base, models)).response;
}
export async function catalog(options: BlueprintsApiOptions, load = options.revisions.latest()) {
  const revision = load ? await options.processRepository.revisionAt(load.commit) : undefined;
  const repositoryPaths = new Set(
    ((await revision?.list("blueprints")) ?? []).filter((path) => /\.ya?ml$/.test(path)),
  );
  const paths = [...new Set([...repositoryPaths, ...options.bundle.blueprints.keys()])].sort(
    (a, b) => {
      const left = Array.from(a, (c) => c.codePointAt(0)!);
      const right = Array.from(b, (c) => c.codePointAt(0)!);
      for (let i = 0; i < Math.min(left.length, right.length); i++)
        if (left[i] !== right[i]) return left[i]! - right[i]!;
      return left.length - right.length;
    },
  );
  const counts = new Map<string, number>();
  for (const snapshot of options.store.activeSnapshots()) {
    const version = parseBlueprintVersionKey(snapshot.machine);
    if (version) counts.set(version.path, (counts.get(version.path) ?? 0) + 1);
  }
  const blueprints: BlueprintItem[] = [];
  for (const path of paths) {
    const own = repositoryPaths.has(path);
    const loaded = load?.blueprints.get(path);
    const failures = load?.failures.get(path);
    // Loaded repository facts are already immutable at this revision.
    let lint;
    if (!own || !loaded) {
      const text = own ? await revision!.read(path) : options.bundle.blueprints.get(path);
      if (text === undefined) continue;
      lint = await lintBlueprint(path, text, manifoldImplementationNames, {
        configurationBound: options.configurationBound,
      });
    }
    const findings = failures
      ? failures.filter((f) => f.kind !== "token-potential" && f.kind !== "token-unknown").length
      : lint && !lint.ok
        ? lint.findings.length
        : 0;
    const warnings = loaded?.warnings.length ?? lint?.warnings.length ?? 0;
    const description =
      loaded?.document.description ?? (!own && lint?.ok ? lint.blueprint.description : undefined);
    blueprints.push({
      path,
      source: own ? "repository" : "bundled",
      ...(load ? { commit: load.commit } : {}),
      ...(!own
        ? { bundle: options.bundle.digest }
        : options.bundle.blueprints.has(path)
          ? { replacesBundled: true as const }
          : {}),
      status: (own ? !!loaded : findings === 0) ? "loaded" : "invalid",
      findings,
      warnings,
      ...(description === undefined ? {} : { description }),
      activeActors: counts.get(path) ?? 0,
    });
  }
  return listAnswer(options.repository, load?.commit, blueprints);
}
export async function sourceText(
  options: BlueprintsApiOptions,
  path: string,
  load: RevisionLoad | undefined = options.revisions.latest(),
) {
  const revision = load ? await options.processRepository.revisionAt(load.commit) : undefined;
  const own = await revision?.read(path);
  const text = own ?? options.bundle.blueprints.get(path);
  if (text === undefined) return undefined;
  return {
    path,
    source: own === undefined ? ("bundled" as const) : ("repository" as const),
    ...(load ? { commit: load.commit } : {}),
    ...(own === undefined ? { bundle: options.bundle.digest } : {}),
    text,
    ...(await lintText(options, path, text)),
  };
}
