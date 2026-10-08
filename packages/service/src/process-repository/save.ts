// ---
// relationships:
//   implements: process-repository
// ---
import git from "isomorphic-git";
import type { TreeEntry } from "isomorphic-git";
import type { Credential } from "../service-configuration/index.ts";
import type { GitObjects } from "./revision.ts";
import { revision } from "./revision.ts";
import { gitHttp } from "./git-http.ts";
import { carriesSave, saveMessage } from "./save-message.ts";
import { ProcessRepositorySaveError } from "./types.ts";
import type { ProcessRepositoryOptions, SaveOutcome, SaveRequest } from "./types.ts";

export async function findSave(
  objects: GitObjects,
  head: string | undefined,
  request: Pick<SaveRequest, "base" | "saveId">,
): Promise<string | undefined> {
  while (head) {
    const { commit } = await git.readCommit({ ...objects, oid: head });
    if (carriesSave(commit.message, request.saveId)) return head;
    if (head === request.base) break;
    head = commit.parent[0];
  }
  return undefined;
}
async function changedTree(
  objects: GitObjects,
  oid: string | undefined,
  segments: string[],
  blob: string,
): Promise<string> {
  const entries = oid ? [...(await git.readTree({ ...objects, oid })).tree] : [];
  const path = segments[0]!;
  const existing = entries.find((entry) => entry.path === path);
  const leaf = segments.length === 1;
  const child = leaf
    ? blob
    : await changedTree(
        objects,
        existing?.type === "tree" ? existing.oid : undefined,
        segments.slice(1),
        blob,
      );
  const entry: TreeEntry = {
    path,
    mode: leaf ? (existing?.mode === "100755" ? "100755" : "100644") : "040000",
    type: leaf ? "blob" : "tree",
    oid: child,
  };
  return git.writeTree({
    ...objects,
    tree: [...entries.filter((entry) => entry.path !== path), entry],
  });
}
export async function saveRevision(
  options: ProcessRepositoryOptions,
  objects: GitObjects,
  credential: Credential | undefined,
  head: string | undefined,
  request: SaveRequest,
): Promise<SaveOutcome> {
  if (
    !Array.isArray(request.files) ||
    !request.files.length ||
    new Set(request.files.map((file) => file.path)).size !== request.files.length ||
    request.files.some(
      (file: { path: string; text: string }) =>
        typeof file.path !== "string" ||
        typeof file.text !== "string" ||
        file.path.includes("\\") ||
        file.path
          .split("/")
          .some((segment) => segment === "" || segment === "." || segment === ".."),
    ) ||
    !/^[a-f0-9]{32}$/.test(request.saveId)
  )
    throw new TypeError("Invalid save path or saveId");
  if (!head) throw new TypeError("Save requires a current commit");
  const saved = await findSave(objects, head, request);
  if (saved) return { kind: "already-saved", commit: saved };
  const current = revision(objects, head);
  const texts = await Promise.all(request.files.map((file) => current.read(file.path)));
  let base;
  try {
    await git.readCommit({ ...objects, oid: request.base });
    base = revision(objects, request.base);
  } catch {
    /* Unknown base is a conflict. */
  }
  if (
    !base ||
    (await Promise.all(request.files.map((file) => base.read(file.path)))).some(
      (text, index) => text !== texts[index],
    )
  )
    return { kind: "conflict", head, text: request.files.length === 1 ? texts[0] : undefined };
  if (request.files.every((file, index) => file.text === texts[index]))
    return { kind: "unchanged", commit: head };
  const { commit: parent } = await git.readCommit({ ...objects, oid: head });
  let tree = parent.tree;
  for (const file of request.files) {
    const blob = await git.writeBlob({ ...objects, blob: Buffer.from(file.text) });
    tree = await changedTree(objects, tree, file.path.split("/"), blob);
  }
  const author = {
    ...options.configuration.commitAuthor,
    timestamp: Math.floor(Date.now() / 1000),
    timezoneOffset: 0,
  };
  const commit = await git.writeCommit({
    ...objects,
    commit: {
      tree,
      parent: [head],
      author,
      committer: author,
      message: saveMessage(request.message, request.saveId),
    },
  });
  await git.writeRef({ ...objects, ref: "refs/manifold/save", value: commit, force: true });
  options.saveProbe?.("committed", commit);
  const configuration = options.configuration;
  const signal = AbortSignal.timeout(configuration.pullTimeoutMs);
  const context = `${configuration.url} branch ${configuration.branch}${credential ? ` credential ${credential.name}` : ""}`;
  try {
    if (credential && credential.kind !== "github-app")
      throw new Error("Requires github-app credential");
    const result = await git.push({
      ...objects,
      http: gitHttp(signal),
      url: configuration.url,
      ref: "refs/manifold/save",
      remoteRef: `refs/heads/${configuration.branch}`,
      force: false,
      ...(credential
        ? {
            onAuth: async () => {
              const name = new URL(configuration.url).pathname
                .split("/")
                .findLast(Boolean)!
                .replace(/\.git$/, "");
              const token = await credential.installationToken({
                repositories: [name],
                permissions: { contents: "write" },
                signal,
              });
              return { username: "x-access-token", password: token.reveal() };
            },
          }
        : {}),
      onAuthFailure: () => ({ cancel: true }),
    });
    if (!result.ok)
      throw new ProcessRepositorySaveError(
        "rejected",
        head,
        `Push rejected: ${context}: ${result.error ?? ""}`,
      );
  } catch (error) {
    if (signal.aborted)
      throw new ProcessRepositorySaveError(
        "remote",
        head,
        `Push timeout after ${configuration.pullTimeoutMs} ms: ${context}`,
      );
    if (error instanceof ProcessRepositorySaveError) throw error;
    const kind =
      error instanceof git.Errors.PushRejectedError || error instanceof git.Errors.GitPushError
        ? "rejected"
        : error instanceof git.Errors.UserCanceledError ||
            (error instanceof git.Errors.HttpError && [401, 403].includes(error.data.statusCode))
          ? "authentication"
          : "remote";
    throw new ProcessRepositorySaveError(
      kind,
      head,
      `Push ${kind}: ${context}${kind === "rejected" && error instanceof Error ? `: ${error.message}` : ""}`,
    );
  }
  options.saveProbe?.("pushed", commit);
  return { kind: "pushed", commit, parent: head };
}
