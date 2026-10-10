// ---
// relationships:
//   implements: [declarations-api, operator-console]
// ---
import {
  lintInvokedDecisionModels,
  lintProcessManifest,
  findingRanges,
} from "@wyrd-company/manifold-shared";
import type { ProcessRepositoryRevision } from "@wyrd-company/manifold-shared";
import type { ModelFinding, PublishRequest } from "@wyrd-company/manifold-shared/declarations-api";
import { overlay, modelFindings, locatedFindings } from "./model-files.ts";
import { validPath } from "../blueprints-api/request-checks.ts";
import { saveAnswer } from "../blueprints-api/answers.ts";
import type { DeclarationsApiOptions } from "./types.ts";
export async function publish(
  options: DeclarationsApiOptions,
  revision: ProcessRepositoryRevision,
  request: PublishRequest,
) {
  const read = overlay(revision.read, request.files);
  const findings: ModelFinding[] = [],
    warnings: ModelFinding[] = [];
  for (const file of request.files) {
    if (validPath(file.path)) {
      const models = await lintInvokedDecisionModels(read, file.text);
      const lint = await options.lintBlueprint(file.path, file.text, models, {
        ...revision,
        read,
      });
      findings.push(
        ...findingRanges(file.text, lint.ok ? [] : lint.findings).map((f) => ({
          ...f,
          file: file.path,
        })),
      );
      warnings.push(
        ...findingRanges(file.text, lint.warnings).map((f) => ({
          ...f,
          file: file.path,
        })),
      );
    } else {
      const lint = await modelFindings(read, file.path, file.text);
      findings.push(...lint.findings);
      warnings.push(...lint.warnings);
    }
  }
  // Manifest lint follows every reachable model, including a broken dependency.
  const reached = new Set<string>();
  const manifest = await lintProcessManifest(async (path) => {
    if (path !== "manifold.yml") reached.add(path);
    return read(path);
  });
  if (request.files.some((f) => reached.has(f.path))) {
    const lint = locatedFindings(
      manifest.findings,
      new Map(request.files.map((f) => [f.path, f.text])),
    );
    for (const row of lint.findings)
      if (
        !findings.some(
          (f) => f.file === row.file && f.location === row.location && f.kind === row.kind,
        )
      )
        findings.push(row);
    for (const row of lint.warnings)
      if (
        !warnings.some(
          (f) => f.file === row.file && f.location === row.location && f.kind === row.kind,
        )
      )
        warnings.push(row);
  }
  if (findings.length)
    return {
      status: 422,
      body: {
        error: "invalid",
        message: "Publication has findings.",
        findings,
        warnings,
      },
    };
  const saved = await options.revisions.save(request);
  const mapped = saveAnswer(saved);
  return {
    status: mapped.status,
    body:
      saved.outcome === "conflict"
        ? {
            error: "conflict",
            message: "The process repository branch changed.",
            reason: saved.reason,
            head: saved.head,
            files: saved.files,
          }
        : { ...mapped.body, loaded: saved.blueprints !== undefined },
  };
}
