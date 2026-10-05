// ---
// relationships:
//   verifies: process-repository
// ---
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import git from "isomorphic-git";
import { afterEach, expect, test } from "vite-plus/test";
import { openProcessRepository } from "./index.ts";
import { fixture } from "./test-fixtures/remote.ts";
const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
});
async function setup() {
  const directory = await fs.mkdtemp(join(tmpdir(), "save-"));
  cleanup.push(() => fs.rm(directory, { recursive: true, force: true }));
  const remote = await fixture(directory);
  cleanup.push(() => remote.close());
  await git.setConfig({ fs, gitdir: remote.gitdir, path: "http.receivepack", value: true });
  const base = await remote.commit("first");
  const configuration = {
    url: remote.url,
    branch: "main",
    credential: undefined,
    directory: join(directory, "clone"),
    pullTimeoutMs: 2000,
    commitAuthor: { name: "Manifold", email: "manifold@manifold.invalid" },
  };
  const options = {
    configuration,
    credentials: {
      names: [],
      resolve() {
        throw new Error("Not used");
      },
    },
  };
  const repository = await openProcessRepository(options);
  await repository.pull();
  const request = {
    base,
    path: "blueprints/nested/example.yml",
    text: "example: true\n",
    message: "Change example  \n",
    saveId: "a".repeat(32),
  };
  return { remote, repository, options, request };
}
test("save pushes one file, preserves entries, and finds its trailer after a pull", async () => {
  const { remote, repository, request } = await setup();
  const outcome = await repository.save(request);
  expect(outcome).toMatchObject({ kind: "pushed", parent: request.base });
  const head = await git.resolveRef({ fs, gitdir: remote.gitdir, ref: "main" });
  const { commit } = await git.readCommit({ fs, gitdir: remote.gitdir, oid: head });
  expect(commit.parent).toEqual([request.base]);
  expect(commit.author).toMatchObject({
    name: "Manifold",
    email: "manifold@manifold.invalid",
    timezoneOffset: 0,
  });
  expect(commit.committer).toEqual(commit.author);
  expect(commit.message).toBe(`Change example\n\nManifold-Save: ${request.saveId}\n`);
  expect(repository.current()!.commit).toBe(request.base);
  await repository.pull();
  expect(await repository.current()!.read(request.path)).toBe(request.text);
  expect(await repository.current()!.read("recipes/a.txt")).toBe("first");
  expect(await repository.current()!.list("")).toEqual([
    "blueprints/nested/example.yml",
    "recipes/a.txt",
    "z.txt",
  ]);
  const requests = remote.requests.length;
  expect(await repository.save(request)).toEqual({ kind: "already-saved", commit: head });
  expect(await repository.findSave(request)).toBe(head);
  expect(await repository.findSave({ base: request.base, saveId: "b".repeat(32) })).toBeUndefined();
  expect(remote.requests).toHaveLength(requests);
  expect(await repository.save({ ...request, base: head, saveId: "c".repeat(32) })).toEqual({
    kind: "unchanged",
    commit: head,
  });
});
test("save accepts unrelated branch changes and conflicts when the edited file changes", async () => {
  const { remote, repository, request } = await setup();
  const changed = await remote.commit("second");
  await repository.pull();
  expect(await repository.save(request)).toMatchObject({ kind: "pushed", parent: changed });
  await repository.pull();
  expect(await repository.save({ ...request, saveId: "b".repeat(32), text: "changed" })).toEqual({
    kind: "conflict",
    head: repository.current()!.commit,
    text: request.text,
  });
  expect(
    await repository.save({ ...request, base: "f".repeat(40), saveId: "c".repeat(32) }),
  ).toMatchObject({ kind: "conflict" });
});
test.each(["../blueprints/a.yml", "blueprints//a.yml", "blueprints/a\\b.yml", ""])(
  "rejects malformed path %s",
  async (path) => {
    const { repository, request } = await setup();
    await expect(repository.save({ ...request, path })).rejects.toThrow(
      "Invalid save path or saveId",
    );
  },
);
test.each(["task-metadata.yml", "other/a.yml", "blueprints/a.json"])(
  "save accepts any safe process repository path %s",
  async (path) => {
    const { repository, request } = await setup();
    expect(await repository.save({ ...request, path })).toMatchObject({ kind: "pushed" });
  },
);
test("rejects malformed save identity and a remote branch which moved before push", async () => {
  const { remote, repository, options, request } = await setup();
  await expect(repository.save({ ...request, saveId: "bad" })).rejects.toThrow(TypeError);
  const moved = await remote.commit("concurrent");
  const stale = await openProcessRepository(options);
  await expect(stale.save(request)).rejects.toMatchObject({ kind: "rejected", head: request.base });
  expect(await git.resolveRef({ fs, gitdir: remote.gitdir, ref: "main" })).toBe(moved);
});

test.each(["committed", "pushed"] as const)(
  "killed save at %s converges to one remote commit",
  async (stop) => {
    const { fork } = await import("node:child_process");
    const { remote, options, request } = await setup();
    const child = fork(
      new URL("./test-fixtures/save-crash-worker.ts", import.meta.url),
      [JSON.stringify(options.configuration), JSON.stringify(request), stop],
      { silent: true },
    );
    let stderr = "";
    child.stderr!.on("data", (data) => {
      stderr += String(data);
    });
    const killed = new Promise<void>((resolve) => child.once("exit", () => resolve()));
    cleanup.push(async () => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
        await killed;
      }
    });
    await new Promise<void>((resolve, reject) => {
      child.on("message", (message) => {
        if (message === stop) resolve();
      });
      child.once("exit", () => reject(new Error(`Unexpected child exit: ${stderr}`)));
    });
    child.kill("SIGKILL");
    await killed;
    const reopened = await openProcessRepository(options);
    await reopened.pull();
    const outcome = await reopened.save(request);
    expect(outcome.kind).toBe(stop === "committed" ? "pushed" : "already-saved");
    await reopened.pull();
    const head = await git.resolveRef({ fs, gitdir: remote.gitdir, ref: "main" });
    expect((await git.readCommit({ fs, gitdir: remote.gitdir, oid: head })).commit.parent).toEqual([
      request.base,
    ]);
    expect(await reopened.current()!.read(request.path)).toBe(request.text);
  },
);

test("push requests contents write, refuses authentication, and bounds a stalled push", async () => {
  const { remote, options, request } = await setup();
  const permissions: unknown[] = [];
  const { SecretValue } = await import("../service-configuration/index.ts");
  const credentials = {
    names: ["example"],
    resolve() {
      return {
        kind: "github-app" as const,
        name: "example",
        async installationToken(input: { permissions?: unknown }) {
          permissions.push(input.permissions);
          return new SecretValue("example", "generic-token");
        },
      };
    },
  };
  remote.state.auth = "generic-token";
  const repository = await openProcessRepository({
    ...options,
    credentials,
    configuration: { ...options.configuration, credential: "example" },
  });
  await repository.pull();
  await repository.save(request);
  expect(permissions).toEqual([{ contents: "read" }, { contents: "write" }]);
  await repository.pull();
  remote.state.auth = "refused";
  const second = {
    ...request,
    base: repository.current()!.commit,
    saveId: "b".repeat(32),
    text: "second",
  };
  await expect(repository.save(second)).rejects.toMatchObject({ kind: "authentication" });
  remote.state.auth = "generic-token";
  remote.state.mode = "headers";
  const bounded = await openProcessRepository({
    ...options,
    credentials,
    configuration: { ...options.configuration, credential: "example", pullTimeoutMs: 200 },
  });
  await expect(bounded.save(second)).rejects.toMatchObject({
    kind: "remote",
    message: expect.stringContaining("timeout"),
  });
  remote.state.mode = "healthy";
  expect(await repository.save(second)).toMatchObject({ kind: "pushed" });
});

test("findSave traverses a later first-parent descendant without network requests", async () => {
  const { repository, request } = await setup();
  const first = await repository.save(request);
  if (first.kind !== "pushed") throw new Error("Expected pushed save");
  await repository.pull();
  await repository.save({
    ...request,
    base: repository.current()!.commit,
    saveId: "b".repeat(32),
    path: "blueprints/other.yaml",
  });
  await repository.pull();
  expect(await repository.findSave(request)).toBe(first.commit);
  expect(
    await repository.findSave({ base: repository.current()!.commit, saveId: request.saveId }),
  ).toBeUndefined();
});

test("remote receive-pack refuses a branch move after push advertisement", async () => {
  const { remote, repository, request } = await setup();
  let changed: string | undefined;
  remote.state.beforeReceive = async () => {
    changed = await remote.commit("raced");
  };
  await expect(repository.save(request)).rejects.toMatchObject({
    kind: "rejected",
    head: request.base,
  });
  expect(await git.resolveRef({ fs, gitdir: remote.gitdir, ref: "main" })).toBe(changed);
  expect(repository.current()!.commit).toBe(request.base);
});

test("a save queued behind a pull observes its published head and a queued pull sees the pushed commit", async () => {
  const { remote, repository, request } = await setup();
  const changed = await remote.commit("later");
  const hold = remote.holdNext();
  const pull = repository.pull();
  await hold.reached;
  const save = repository.save(request);
  const after = repository.pull();
  hold.release();
  expect(await pull).toMatchObject({ commit: changed });
  const saved = await save;
  expect(saved).toMatchObject({ kind: "pushed", parent: changed });
  if (saved.kind !== "pushed") throw new Error("Expected pushed save");
  expect(await after).toMatchObject({ commit: saved.commit });
  expect(repository.current()!.commit).toBe(saved.commit);
});
