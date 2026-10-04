// ---
// relationships:
//   verifies: process-repository
// ---
import * as fs from "node:fs/promises";
import { readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import {
  openProcessRepository,
  ProcessRepositoryOpenError,
  ProcessRepositoryPullError,
} from "./index.ts";
import { fixture } from "./test-fixtures/remote.ts";
import type {
  Credentials,
  ProcessRepositoryConfiguration,
} from "../service-configuration/index.ts";
const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
});
const credentials: Credentials = {
  names: [],
  resolve(name) {
    throw new Error(`Unknown ${name}`);
  },
};
async function setup(timeout = 2000) {
  const directory = await fs.mkdtemp(join(tmpdir(), "repository-"));
  cleanup.push(() => fs.rm(directory, { recursive: true, force: true }));
  const remote = await fixture(directory);
  cleanup.push(() => remote.close());
  const configuration: ProcessRepositoryConfiguration = {
    url: remote.url,
    branch: "main",
    directory: join(directory, "clone"),
    credential: undefined,
    pullTimeoutMs: timeout,
  };
  const a = await remote.commit("first");
  return { directory, remote, configuration, a };
}
async function objectFiles(directory: string): Promise<string[]> {
  return (await fs.readdir(join(directory, "git/objects"), { recursive: true })).sort();
}
test("pulls in process, negotiates current commit, preserves older revisions across restart and force push", async () => {
  const { remote, configuration, a } = await setup();
  const repository = await openProcessRepository({ configuration, credentials });
  expect(repository.current()).toBeUndefined();
  expect(await repository.pull()).toEqual({ kind: "advanced", commit: a, previous: undefined });
  const held = repository.current()!;
  expect(await held.read("recipes/a.txt")).toBe("first");
  expect(await held.list("")).toEqual(["recipes/a.txt", "z.txt"]);
  expect(await held.list("recipes")).toEqual(["recipes/a.txt"]);
  for (const path of ["link", "recipes", "absent"]) expect(await held.read(path)).toBeUndefined();
  expect(await held.list("z.txt")).toEqual([]);
  for (const path of ["../x", "/x", "a//b", "x\\y", "x/", ".", ""]) {
    await expect(held.read(path)).rejects.toThrow(TypeError);
    if (path) await expect(held.list(path)).rejects.toThrow(TypeError);
  }
  const before = await objectFiles(configuration.directory);
  expect(await repository.pull()).toEqual({ kind: "unchanged", commit: a });
  expect(
    remote.requests
      .findLast((r) => r.path.endsWith("git-upload-pack"))
      ?.body.match(/have [0-9a-f]{40}/g),
  ).toEqual([`have ${a}`]);
  expect(await objectFiles(configuration.directory)).toEqual(before);
  const count = remote.requests.length;
  expect(await repository.pull({ commit: a })).toEqual({ kind: "unchanged", commit: a });
  expect(remote.requests).toHaveLength(count);
  expect(repository.current()).toBe(held);
  const b = await remote.commit("second");
  expect(await repository.pull()).toEqual({ kind: "advanced", commit: b, previous: a });
  expect(await held.read("recipes/a.txt")).toBe("first");
  expect(await repository.current()!.read("external")).toBeUndefined();
  expect(await repository.current()!.list("")).toEqual(["recipes/a.txt", "z.txt"]);
  const reopened = await openProcessRepository({ configuration, credentials });
  expect(reopened.current()!.commit).toBe(b);
  expect(await (await reopened.revisionAt(a))!.read("recipes/a.txt")).toBe("first");
  expect(await reopened.revisionAt("main")).toBeUndefined();
  expect(await reopened.revisionAt("f".repeat(40))).toBeUndefined();
  await remote.force(a);
  expect(await reopened.pull()).toEqual({ kind: "advanced", commit: a, previous: b });
  expect(await (await reopened.revisionAt(b))!.read("recipes/a.txt")).toBe("second");
});
test.each(["fetched", "verified"] as const)(
  "interruption at %s preserves current and recovers on reopen",
  async (step) => {
    const { remote, configuration, a } = await setup();
    const initial = await openProcessRepository({ configuration, credentials });
    await initial.pull();
    const b = await remote.commit("second");
    const interrupted = await openProcessRepository({
      configuration,
      credentials,
      probe(observed) {
        if (observed === step) throw new Error("Interrupted");
      },
    });
    await expect(interrupted.pull()).rejects.toThrow("Interrupted");
    expect(interrupted.current()!.commit).toBe(a);
    const recovered = await openProcessRepository({ configuration, credentials });
    expect(await recovered.current()!.read("recipes/a.txt")).toBe("first");
    expect(await recovered.pull()).toMatchObject({ commit: b, kind: "advanced" });
  },
);
test.each(["headers", "pack", "close"] as const)(
  "failed %s request preserves revision and next healthy pull runs",
  async (mode) => {
    const { remote, configuration, a } = await setup(200);
    const repository = await openProcessRepository({ configuration, credentials });
    await repository.pull();
    const b = await remote.commit("second");
    remote.state.mode = mode;
    await expect(repository.pull()).rejects.toMatchObject({ kind: "remote" });
    expect(repository.current()!.commit).toBe(a);
    expect(await repository.current()!.read("recipes/a.txt")).toBe("first");
    remote.state.mode = "healthy";
    expect(await repository.pull()).toMatchObject({ commit: b, kind: "advanced" });
  },
);
test("unknown branch and refused authentication are typed without moving current", async () => {
  const { remote, configuration } = await setup();
  const repository = await openProcessRepository({ configuration, credentials });
  await repository.pull();
  const missing = await openProcessRepository({
    configuration: { ...configuration, branch: "missing" },
    credentials,
  });
  await expect(missing.pull()).rejects.toMatchObject({ kind: "branch-missing" });
  remote.state.auth = "refused";
  await expect(repository.pull()).rejects.toMatchObject({ kind: "authentication" });
  expect(ProcessRepositoryPullError.prototype).toBeInstanceOf(Error);
});
test("recovery removes only unpublished residue and rejects corrupted current", async () => {
  const { configuration, a } = await setup();
  const repository = await openProcessRepository({ configuration, credentials });
  await repository.pull();
  const gitdir = join(configuration.directory, "git");
  await fs.writeFile(join(configuration.directory, "current.example.tmp"), "partial");
  await fs.writeFile(join(gitdir, "objects/pack/partial.manifold-tmp"), "partial");
  await fs.writeFile(join(gitdir, `objects/pack/pack-${"f".repeat(40)}.pack`), "partial");
  await fs.mkdir(join(gitdir, "refs/heads"), { recursive: true });
  await fs.writeFile(join(gitdir, "refs/heads/main"), "f".repeat(40));
  const recovered = await openProcessRepository({ configuration, credentials });
  expect(recovered.current()!.commit).toBe(a);
  await recovered.pull();
  expect(await fs.readdir(configuration.directory)).not.toContain("current.example.tmp");
  expect(
    (await fs.readdir(join(gitdir, "objects/pack"))).some(
      (name) => name.includes("partial") || name.includes("f".repeat(40)),
    ),
  ).toBe(false);
  const pack = (await fs.readdir(join(gitdir, "objects/pack"))).find((name) =>
    name.endsWith(".pack"),
  )!;
  await fs.writeFile(join(gitdir, "objects/pack", pack), "corrupt");
  await expect(openProcessRepository({ configuration, credentials })).rejects.toBeInstanceOf(
    ProcessRepositoryOpenError,
  );
});

test("concurrent requests share one subsequent pull and it runs after a timeout", async () => {
  const { remote, configuration } = await setup(200);
  const repository = await openProcessRepository({ configuration, credentials });
  await repository.pull();
  const b = await remote.commit("second");
  remote.state.mode = "pack";
  const started = new Promise<void>((resolve) => {
    remote.state.packStarted = resolve;
  });
  const first = repository.pull();
  const firstError = first.catch((error) => error);
  await started;
  const second = repository.pull();
  const third = repository.pull();
  expect(second).toBe(third);
  remote.state.mode = "healthy";
  expect(await firstError).toMatchObject({ kind: "remote" });
  expect(await second).toMatchObject({ commit: b, kind: "advanced" });
  expect(remote.requests.filter((request) => request.path.includes("/info/refs"))).toHaveLength(3);
});

test("verification rejects an unreadable newly fetched object before publication", async () => {
  const { remote, configuration, a } = await setup();
  const original = await openProcessRepository({ configuration, credentials });
  await original.pull();
  const directory = join(configuration.directory, "git/objects/pack");
  const before = new Set(await fs.readdir(directory));
  await remote.commit("second");
  const repository = await openProcessRepository({
    configuration,
    credentials,
    probe(step) {
      if (step === "fetched") {
        const pack = readdirSync(directory).find(
          (name) => !before.has(name) && name.endsWith(".pack"),
        )!;
        writeFileSync(join(directory, pack), "incomplete");
      }
    },
  });
  await expect(repository.pull()).rejects.toMatchObject({ kind: "incomplete" });
  expect(await fs.readFile(join(configuration.directory, "current"), "utf8")).toBe(a + "\n");
  expect(repository.current()!.commit).toBe(a);
  expect(await repository.current()!.read("recipes/a.txt")).toBe("first");
});

test("a request from a settled-pull callback joins the already queued successor", async () => {
  const { remote, configuration } = await setup(200);
  const repository = await openProcessRepository({ configuration, credentials });
  await repository.pull();
  const b = await remote.commit("second");
  remote.state.mode = "pack";
  const started = new Promise<void>((resolve) => {
    remote.state.packStarted = resolve;
  });
  let late: ReturnType<typeof repository.pull> | undefined;
  const first = repository.pull().catch((error) => {
    late = repository.pull();
    void late.catch(() => undefined);
    return error;
  });
  await started;
  const next = repository.pull();
  void next.catch(() => undefined);
  remote.state.mode = "healthy";
  await first;
  try {
    expect(late).toBe(next);
    expect(await next).toMatchObject({ kind: "advanced", commit: b });
    expect(remote.requests.filter((request) => request.path.includes("/info/refs"))).toHaveLength(
      3,
    );
    const c = await remote.commit("third");
    expect(await repository.pull()).toEqual({ kind: "advanced", commit: c, previous: b });
  } finally {
    await Promise.allSettled([next, late]);
  }
});
