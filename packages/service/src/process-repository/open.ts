// ---
// relationships:
//   implements: process-repository
// ---
import git from "isomorphic-git";
import { layout } from "./layout.ts";
import { gitFileSystem } from "./git-fs.ts";
import { recover } from "./recover.ts";
import { revision } from "./revision.ts";
import { saveRevision, findSave } from "./save.ts";
import { pullRevision } from "./pull.ts";
import type {
  ProcessRepository,
  ProcessRepositoryOptions,
  PullOutcome,
  PullRequest,
} from "./types.ts";
export async function openProcessRepository(
  options: ProcessRepositoryOptions,
): Promise<ProcessRepository> {
  const credential = options.configuration.credential
    ? options.credentials.resolve(options.configuration.credential)
    : undefined;
  const paths = layout(options.configuration.directory);
  const objects = { gitdir: paths.gitdir, fs: gitFileSystem(paths.gitdir), cache: {} };
  const commit = await recover(paths, objects);
  let current = commit ? revision(objects, commit) : undefined;
  let running: Promise<unknown> | undefined;
  let tail: Promise<unknown> = Promise.resolve();
  function exclusive<T>(run: () => Promise<T>): Promise<T> {
    const promise = tail.catch(() => undefined).then(run);
    tail = promise;
    running = promise;
    void promise
      .finally(() => {
        if (running === promise) running = undefined;
      })
      .catch(() => undefined);
    return promise;
  }
  let queued: Promise<PullOutcome> | undefined;
  let queuedCommit: string | undefined;
  function launch(request?: PullRequest): Promise<PullOutcome> {
    const promise = exclusive(() =>
      pullRevision(options, objects, paths, credential, current?.commit, request),
    )
      .then((outcome) => {
        if (outcome.kind === "advanced") {
          current = revision(objects, outcome.commit);
          options.probe?.("published", outcome.commit);
        }
        return outcome;
      })
      .finally(() => {
        if (running === promise) running = undefined;
      });
    running = promise;
    return promise;
  }
  return {
    current: () => current,
    async isAncestor(ancestor, commit) {
      if (ancestor === commit || !/^[a-f0-9]{40}$/.test(ancestor) || !/^[a-f0-9]{40}$/.test(commit))
        return false;
      try {
        return await git.isDescendent({ ...objects, oid: commit, ancestor });
      } catch {
        return false;
      }
    },
    async revisionAt(commit: string) {
      if (!/^[a-f0-9]{40}$/.test(commit)) return undefined;
      try {
        await git.readCommit({ ...objects, oid: commit });
        return revision(objects, commit);
      } catch {
        return undefined;
      }
    },
    save(request) {
      return exclusive(() => saveRevision(options, objects, credential, current?.commit, request));
    },
    findSave(request) {
      return exclusive(() => findSave(objects, current?.commit, request));
    },
    pull(request?: PullRequest) {
      if (queued) {
        if (request?.commit !== queuedCommit) queuedCommit = undefined;
        return queued;
      }
      if (!running) return launch(request);
      queuedCommit = request?.commit;
      queued = running
        .catch(() => undefined)
        .then(() => {
          const request = queuedCommit === undefined ? undefined : { commit: queuedCommit };
          queued = undefined;
          queuedCommit = undefined;
          return launch(request);
        });
      return queued;
    },
  };
}
