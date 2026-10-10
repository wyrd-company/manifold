// ---
// relationships:
//   implements: [github-event-source, task-metadata]
// ---
import { request } from "@octokit/request";
import { repositoryInScope } from "@wyrd-company/manifold-shared";
import type { StorageScope } from "@wyrd-company/manifold-shared";
import { GitHubWriteError } from "../github-source/index.ts";
import type {
  GitHubConfiguration,
  ScopeConfiguration,
  ScopeEntityWrite,
  ScopeEntity,
  LabelConfiguration,
  MilestoneConfiguration,
  TaskFieldWrite,
  TrackedIssue,
} from "../github-source/index.ts";
import type { Credentials } from "../service-configuration/index.ts";
const object = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new GitHubWriteError("rejected", "Invalid GitHub repository entity");
  return value as Record<string, unknown>;
};
const string = (value: unknown) => {
  if (typeof value !== "string")
    throw new GitHubWriteError("rejected", "Invalid GitHub repository text");
  return value;
};
function label(value: unknown): LabelConfiguration {
  const raw = object(value);
  const color = string(raw["color"]).toLowerCase();
  if (!/^[a-f0-9]{6}$/.test(color))
    throw new GitHubWriteError("rejected", "Invalid GitHub label color");
  return {
    nodeId: string(raw["node_id"]),
    name: string(raw["name"]),
    color,
    description: raw["description"] === null ? "" : string(raw["description"]),
  };
}
function milestone(value: unknown): MilestoneConfiguration {
  const raw = object(value);
  const number = raw["number"];
  const state = raw["state"];
  if (
    typeof number !== "number" ||
    !Number.isSafeInteger(number) ||
    number <= 0 ||
    (state !== "open" && state !== "closed")
  )
    throw new GitHubWriteError("rejected", "Invalid GitHub milestone");
  return {
    nodeId: string(raw["node_id"]),
    number,
    title: string(raw["title"]),
    description: raw["description"] === null ? "" : string(raw["description"]),
    state,
  };
}
function failure(error: unknown): GitHubWriteError {
  if (error instanceof GitHubWriteError) return error;
  const status =
    error && typeof error === "object" && "status" in error && typeof error.status === "number"
      ? error.status
      : undefined;
  return new GitHubWriteError(
    status === 401 || status === 403
      ? "forbidden"
      : status === 404
        ? "missing"
        : status === undefined || status === 429 || status >= 500
          ? "transport"
          : "rejected",
    "GitHub repository request failed",
    status,
  );
}
/** Reads current GitHub state for every mutation, so a replay converges after partial writes. */
export function createRepositoryFields(options: {
  configuration: GitHubConfiguration;
  credentials: Credentials;
}) {
  const controller = new AbortController();
  async function call(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    repository: string,
    path: string,
    parameters: Record<string, unknown> = {},
    signal?: AbortSignal,
  ) {
    const [owner, repo] = repository.split("/");
    const configured = Object.entries(options.configuration.owners).find(
      ([name]) => name.toLowerCase() === owner!.toLowerCase(),
    )?.[1];
    if (!configured)
      throw new GitHubWriteError("unavailable", "GitHub repository owner is unconfigured");
    const active = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(options.configuration.requestTimeoutMs),
      ...(signal ? [signal] : []),
    ]);
    try {
      active.throwIfAborted();
      const credential = options.credentials.resolve(configured.credential);
      if (credential.kind !== "github-app")
        throw new GitHubWriteError("unavailable", "GitHub App credential required");
      const token = await credential.installationToken({ signal: active });
      return await request(`${method} /repos/{owner}/{repo}${path}`, {
        baseUrl: options.configuration.apiUrl,
        owner,
        repo,
        ...parameters,
        headers: { authorization: `token ${token.reveal()}` },
        request: { signal: active },
      });
    } catch (error) {
      throw failure(error);
    }
  }
  async function list(
    repository: string,
    path: string,
    signal?: AbortSignal,
    parameters: Record<string, unknown> = {},
  ) {
    const values: unknown[] = [];
    for (let page = 1; ; page++) {
      const answer = await call(
        "GET",
        repository,
        path,
        { ...parameters, per_page: 100, page },
        signal,
      );
      if (!Array.isArray(answer.data))
        throw new GitHubWriteError("rejected", "Invalid GitHub repository list");
      values.push(...answer.data);
      if (!answer.headers.link?.split(",").some((link) => /;\s*rel="next"/.test(link)))
        return values;
    }
  }
  const labels = async (repository: string, signal?: AbortSignal) =>
    (await list(repository, "/labels", signal)).map(label);
  const milestones = async (repository: string, signal?: AbortSignal) =>
    (await list(repository, "/milestones", signal, { state: "all" })).map(milestone);
  return {
    stop: () => controller.abort(),
    async observeScope(scope: StorageScope, signal?: AbortSignal): Promise<ScopeConfiguration> {
      if (scope.kind !== "repository")
        return {
          scope,
          status: "unsupported",
          message: "Repository adapter requires a repository scope",
          readAt: Date.now(),
        };
      const owner = scope.repository.split("/")[0]!;
      if (
        !Object.keys(options.configuration.owners).some(
          (name) => name.toLowerCase() === owner.toLowerCase(),
        )
      )
        return {
          scope,
          status: "unconfigured",
          message: "GitHub repository owner is unconfigured",
          readAt: Date.now(),
        };
      try {
        const observedLabels = await labels(scope.repository, signal);
        const observedMilestones = await milestones(scope.repository, signal);
        return {
          scope,
          status: "ready",
          readAt: Date.now(),
          issueFields: [],
          issueTypes: [],
          labels: observedLabels,
          milestones: observedMilestones,
        };
      } catch (error) {
        const e = failure(error);
        if (e.kind !== "forbidden" && e.kind !== "missing") throw e;
        return { scope, status: e.kind, message: e.message, readAt: Date.now() };
      }
    },
    async writeScopeEntity(
      write: ScopeEntityWrite,
      signal?: AbortSignal,
    ): Promise<ScopeEntity | undefined> {
      if (!("repository" in write))
        throw new GitHubWriteError(
          "unavailable",
          "Repository adapter requires a repository entity",
        );
      const repository = write.repository;
      if (write.kind === "label-create")
        return label(
          (
            await call(
              "POST",
              repository,
              "/labels",
              { name: write.name, color: write.color, description: write.description },
              signal,
            )
          ).data,
        );
      if (write.kind === "label-update" || write.kind === "label-delete") {
        const current = (await labels(repository, signal)).find((l) => l.nodeId === write.nodeId);
        if (!current) {
          if (write.kind === "label-delete") return undefined;
          throw new GitHubWriteError("missing", "Repository label is absent");
        }
        const path = `/labels/${encodeURIComponent(current.name)}`;
        if (write.kind === "label-delete") {
          await call("DELETE", repository, path, {}, signal);
          return undefined;
        }
        return label(
          (
            await call(
              "PATCH",
              repository,
              path,
              {
                ...(write.name !== undefined ? { new_name: write.name } : {}),
                ...(write.color !== undefined ? { color: write.color } : {}),
                ...(write.description !== undefined ? { description: write.description } : {}),
              },
              signal,
            )
          ).data,
        );
      }
      if (write.kind === "milestone-create")
        return milestone(
          (
            await call(
              "POST",
              repository,
              "/milestones",
              { title: write.title, description: write.description },
              signal,
            )
          ).data,
        );
      return milestone(
        (
          await call(
            "PATCH",
            repository,
            `/milestones/${write.number}`,
            {
              ...(write.title !== undefined ? { title: write.title } : {}),
              ...(write.description !== undefined ? { description: write.description } : {}),
            },
            signal,
          )
        ).data,
      );
    },
    async writeTaskField(write: TaskFieldWrite, issue: TrackedIssue, signal?: AbortSignal) {
      const repository = issue.issue.repository;
      const storage = write.storage;
      if (storage.kind !== "label" && storage.kind !== "milestone")
        throw new GitHubWriteError(
          "unavailable",
          "Repository adapter requires a repository task field",
        );
      if (!repositoryInScope(write.repositories, repository))
        throw new GitHubWriteError(
          "out-of-scope",
          "Issue repository is outside the binding's repositories",
        );
      const path = `/issues/${issue.issue.number}`;
      if (storage.kind === "milestone") {
        const option =
          write.value === null
            ? null
            : (await milestones(repository, signal)).find((m) => m.title === write.value);
        if (option === undefined)
          throw new GitHubWriteError("missing", "Declared milestone is absent");
        const issueState = object((await call("GET", repository, path, {}, signal)).data);
        const assigned =
          issueState["milestone"] === null ? null : milestone(issueState["milestone"]).number;
        if (assigned === (option?.number ?? null)) return;
        await call("PATCH", repository, path, { milestone: option?.number ?? null }, signal);
        return;
      }
      const definitions = await labels(repository, signal);
      const name = write.value === null ? null : storage.prefix + String(write.value);
      const selected =
        name === null ? null : definitions.find((l) => l.name.toLowerCase() === name.toLowerCase());
      if (selected === undefined) throw new GitHubWriteError("missing", "Declared label is absent");
      const assigned = (await list(repository, `${path}/labels`, signal)).map(label);
      if (selected && !assigned.some((l) => l.nodeId === selected.nodeId))
        await call("POST", repository, `${path}/labels`, { labels: [selected.name] }, signal);
      const fieldLabels = new Set(write.labels.map((name) => name.toLowerCase()));
      for (const other of assigned)
        if (other.nodeId !== selected?.nodeId && fieldLabels.has(other.name.toLowerCase()))
          await call(
            "DELETE",
            repository,
            `${path}/labels/${encodeURIComponent(other.name)}`,
            {},
            signal,
          );
    },
  };
}
