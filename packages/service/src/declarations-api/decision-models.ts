// ---
// relationships:
//   implements: [declarations-api, decision-models]
// ---
import { parse } from "yaml";
import { lintProcessManifest } from "@wyrd-company/manifold-shared";
import type { ProcessRepositoryRevision } from "@wyrd-company/manifold-shared";
import {
  isDecisionModelPath,
  isRepositoryCommit,
} from "@wyrd-company/manifold-shared/declarations-api";
import type { ModelText } from "@wyrd-company/manifold-shared/declarations-api";
import { record, onlyKeys, saveFields } from "./request-checks.ts";
import { publish } from "./publish.ts";
import { overlay, textFiles, modelFindings } from "./model-files.ts";
import type { DeclarationsApiOptions } from "./types.ts";
export async function intakePath(revision: Pick<ProcessRepositoryRevision, "read">) {
  const result = await lintProcessManifest(revision.read);
  if (
    !result.findings.some(
      (f) => f.file === "manifold.yml" && ["syntax", "schema", "manifest-missing"].includes(f.kind),
    )
  ) {
    const text = await revision.read("manifold.yml");
    if (text !== undefined)
      return (parse(text) as { intake: { decisionModel: string } }).intake.decisionModel;
  }
  return undefined;
}
export async function modelRequest(
  options: DeclarationsApiOptions,
  route: string,
  url: URL,
  body: Record<string, unknown>,
) {
  const failure = (status: number, message: string) => ({
    status,
    body: { error: status === 503 ? "unavailable" : "bad-request", message },
  });
  const isSource = route === "/decision-model";
  const path = isSource ? url.searchParams.get("path") : body["path"];
  const commit = isSource ? (url.searchParams.get("commit") ?? undefined) : body["base"];
  if (commit !== undefined && !isRepositoryCommit(commit))
    return failure(400, "Expected a repository commit.");
  if (route === "/publish") {
    if (
      !onlyKeys(body, ["base", "message", "saveId", "files"]) ||
      !saveFields(body) ||
      !textFiles(body["files"], false) ||
      !body["files"].length
    )
      return failure(400, "Expected base, message, saveId and unique blueprint or model files.");
  } else if (route !== "/decision-models") {
    if (!isDecisionModelPath(path)) return failure(400, "Expected a decision model path.");
    if (!isSource) {
      if (
        !onlyKeys(
          body,
          route.endsWith("evaluate")
            ? ["path", "text", "base", "models", "input"]
            : ["path", "text", "base", "models"],
        ) ||
        typeof body["text"] !== "string" ||
        (body["models"] !== undefined &&
          (!textFiles(body["models"]) || body["models"].some((f) => f.path === path))) ||
        (route.endsWith("evaluate") && !record(body["input"]))
      )
        return failure(400, "Expected text, unique model texts, and an object evaluation input.");
    }
  }
  const latest = options.revisions.latest();
  if (!latest) return failure(503, "No applied process repository revision.");
  const revision = await options.processRepository.revisionAt(
    typeof commit === "string" ? commit : latest.commit,
  );
  if (!revision) return failure(400, "Unknown base revision.");
  if (route === "/publish")
    return publish(options, revision, body as unknown as Parameters<typeof publish>[2]);
  if (route === "/decision-models") {
    const intake = await intakePath(revision);
    const paths = [
      ...new Set([
        ...(await revision.list("decision-models")).filter(isDecisionModelPath),
        ...(intake ? [intake] : []),
      ]),
    ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return {
      status: 200,
      body: {
        commit: revision.commit,
        ...(intake ? { intake } : {}),
        models: await Promise.all(
          paths.map(async (path) => ({
            path,
            exists: (await revision.read(path)) !== undefined,
            intake: path === intake,
          })),
        ),
      },
    };
  }
  const modelPath = path as string;
  if (isSource) {
    const text = await revision.read(modelPath);
    const lint =
      text === undefined
        ? { findings: [], warnings: [] }
        : await modelFindings(revision.read, modelPath, text);
    return {
      status: 200,
      body: {
        path: modelPath,
        commit: revision.commit,
        exists: text !== undefined,
        text: text ?? "",
        findings: lint.findings,
        warnings: lint.warnings,
      },
    };
  }
  const text = body["text"] as string;
  const read = overlay(revision.read, [
    { path: modelPath, text },
    ...((body["models"] as ModelText[] | undefined) ?? []),
  ]);
  const lint = await modelFindings(read, modelPath, text);
  if (route.endsWith("lint"))
    return {
      status: 200,
      body: { findings: lint.findings, warnings: lint.warnings },
    };
  if (!lint.result.ok)
    return {
      status: 422,
      body: {
        error: "invalid",
        message: "Decision model has findings.",
        findings: lint.findings,
        warnings: lint.warnings,
      },
    };
  const models = options.createDecisionModels(lint.result.models);
  try {
    return {
      status: 200,
      body: {
        evaluation: await models.evaluate(modelPath, body["input"] as Record<string, unknown>),
      },
    };
  } finally {
    models.dispose();
  }
}
