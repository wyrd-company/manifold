// ---
// relationships:
//   implements: process-repository
// ---
import * as fs from "node:fs/promises";
import { join } from "node:path";
import git from "isomorphic-git";
import type { GitObjects } from "./revision.ts";
import { verify } from "./revision.ts";
import { gitHttp } from "./git-http.ts";
import { publish } from "./layout.ts";
import type { layout } from "./layout.ts";
import { ProcessRepositoryPullError } from "./types.ts";
import type { ProcessRepositoryOptions, PullOutcome, PullRequest } from "./types.ts";
import type { Credential } from "../service-configuration/index.ts";

export async function pullRevision(
  options: ProcessRepositoryOptions,
  objects: GitObjects,
  paths: ReturnType<typeof layout>,
  credential: Credential | undefined,
  previous: string | undefined,
  request?: PullRequest,
): Promise<PullOutcome> {
  if (previous && request?.commit === previous) return { kind: "unchanged", commit: previous };
  const configuration = options.configuration;
  const signal = AbortSignal.timeout(configuration.pullTimeoutMs);
  const context = `${configuration.url} branch ${configuration.branch}${credential ? ` credential ${credential.name}` : ""}`;
  let commit: string;
  try {
    await fs.rm(join(paths.gitdir, "refs"), { recursive: true, force: true });
    await fs.rm(join(paths.gitdir, "packed-refs"), { force: true });
    if (previous)
      await git.writeRef({
        ...objects,
        ref: `refs/heads/${configuration.branch}`,
        value: previous,
      });
    if (credential && credential.kind !== "github-app")
      throw new Error("Requires github-app credential");
    const result = await git.fetch({
      ...objects,
      http: gitHttp(signal),
      url: configuration.url,
      ref: `refs/heads/${configuration.branch}`,
      singleBranch: true,
      tags: false,
      ...(credential
        ? {
            onAuth: async () => {
              const name = new URL(configuration.url).pathname
                .split("/")
                .findLast(Boolean)!
                .replace(/\.git$/, "");
              const token = await credential.installationToken({
                repositories: [name],
                permissions: { contents: "read" },
                signal,
              });
              return { username: "x-access-token", password: token.reveal() };
            },
          }
        : {}),
      onAuthFailure: () => ({ cancel: true }),
    });
    if (!result.fetchHead) throw new git.Errors.NotFoundError(`refs/heads/${configuration.branch}`);
    commit = result.fetchHead;
  } catch (error) {
    if (signal.aborted)
      throw new ProcessRepositoryPullError(
        "remote",
        `Pull timeout after ${configuration.pullTimeoutMs} ms: ${context}`,
      );
    const kind =
      error instanceof git.Errors.NotFoundError
        ? "branch-missing"
        : error instanceof git.Errors.UserCanceledError ||
            (error instanceof git.Errors.HttpError && [401, 403].includes(error.data.statusCode))
          ? "authentication"
          : "remote";
    throw new ProcessRepositoryPullError(kind, `Pull ${kind}: ${context}`);
  }
  options.probe?.("fetched", commit);
  try {
    await verify(objects, commit);
  } catch {
    throw new ProcessRepositoryPullError("incomplete", `Incomplete commit ${commit}: ${context}`);
  }
  options.probe?.("verified", commit);
  if (commit === previous) return { kind: "unchanged", commit };
  await publish(paths.pointer, commit);
  return { kind: "advanced", commit, previous };
}
