// ---
// relationships:
//   verifies: service-assembly
// ---
import { afterEach, expect, test } from "vite-plus/test";
import git from "isomorphic-git";
import * as fs from "node:fs/promises";
import { startService } from "./index.ts";
import { serviceFixture } from "./test-fixtures/repository.ts";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanups.splice(0).toReversed()) await close();
});
test("a saved blueprint is applied, retries converge and later same-file edits remain applied", async () => {
  const fixture = await serviceFixture();
  cleanups.push(fixture.close);
  await git.setConfig({
    fs,
    gitdir: fixture.remote.gitdir,
    path: "http.receivepack",
    value: "true",
  });
  const service = await startService({ configurationFile: fixture.file, log: () => {} });
  cleanups.push(service.stop);
  const text = (await service.processRepository.current()!.read("blueprints/counter.yml"))!.replace(
    "count: 60",
    "count: 61",
  );
  const request = {
    path: "blueprints/counter.yml",
    base: fixture.first,
    text,
    message: "Change counter",
    saveId: "a".repeat(32),
  };
  const saved = await service.revisions.save({
    ...request,
    files: [{ path: request.path, text: request.text }],
  });
  expect(saved.outcome).toBe("saved");
  if (saved.outcome === "conflict") throw new Error("unexpected conflict");
  expect(saved.blueprints?.commit).toBe(saved.commit);
  expect(saved.blueprints?.blueprints.get(request.path)?.document.machine["context"]).toEqual({
    count: 61,
  });
  expect(
    await service.revisions.save({
      ...request,
      files: [{ path: request.path, text: request.text }],
    }),
  ).toMatchObject({
    outcome: "already-saved",
    commit: saved.commit,
  });
  expect(
    await service.revisions.save({
      ...request,
      base: saved.commit,
      saveId: "b".repeat(32),
      files: [{ path: request.path, text: request.text }],
    }),
  ).toMatchObject({ outcome: "unchanged", commit: saved.commit });
  const later = await service.revisions.save({
    ...request,
    base: saved.commit,
    saveId: "c".repeat(32),
    files: [{ path: request.path, text: text.replace("count: 61", "count: 62") }],
  });
  if (later.outcome === "conflict") throw new Error("unexpected conflict");
  expect(
    await service.revisions.save({
      ...request,
      files: [{ path: request.path, text: request.text }],
    }),
  ).toMatchObject({
    outcome: "already-saved",
    commit: saved.commit,
    blueprints: { commit: later.commit },
  });
  expect(
    await service.revisions.save({
      ...request,
      saveId: "d".repeat(32),
      files: [{ path: request.path, text: request.text }],
    }),
  ).toMatchObject({
    outcome: "conflict",
    reason: "file-changed",
    head: later.commit,
  });
});

async function appendOtherFile(fixture: Awaited<ReturnType<typeof serviceFixture>>) {
  const gitdir = fixture.remote.gitdir;
  const head = await git.resolveRef({ fs, gitdir, ref: "main" });
  const previous = (await git.readCommit({ fs, gitdir, oid: head })).commit;
  const entries = (await git.readTree({ fs, gitdir, oid: previous.tree })).tree.filter(
    (e) => e.path !== "note.txt",
  );
  const blob = await git.writeBlob({ fs, gitdir, blob: Buffer.from(head) });
  const tree = await git.writeTree({
    fs,
    gitdir,
    tree: [...entries, { path: "note.txt", mode: "100644", type: "blob", oid: blob }],
  });
  const oid = await git.writeCommit({
    fs,
    gitdir,
    commit: { ...previous, tree, parent: [head], message: "Change another file" },
  });
  await fixture.remote.force(oid);
  return oid;
}
async function writableService() {
  const fixture = await serviceFixture();
  cleanups.push(fixture.close);
  await git.setConfig({
    fs,
    gitdir: fixture.remote.gitdir,
    path: "http.receivepack",
    value: "true",
  });
  const service = await startService({ configurationFile: fixture.file, log: () => {} });
  cleanups.push(service.stop);
  const text = (await service.processRepository.current()!.read("blueprints/counter.yml"))!.replace(
    "count: 60",
    "count: 61",
  );
  const request = {
    path: "blueprints/counter.yml",
    base: fixture.first,
    text,
    message: "Change counter",
    saveId: "a".repeat(32),
  };
  return { fixture, service, request };
}
test("branch-moved conflicts return every requested head text in order", async () => {
  const { fixture, service, request } = await writableService();
  const paths = ["bindings.yml", request.path, "missing.yml"];
  const expected = await Promise.all(
    paths.map(async (path) => ({
      path,
      text: await service.processRepository.current()!.read(path),
    })),
  );
  fixture.remote.state.beforeReceive = () => appendOtherFile(fixture).then(() => {});
  const result = await service.revisions.save({
    ...request,
    files: paths.map((path) => ({
      path,
      text: path === request.path ? request.text : "# sample\n",
    })),
  });
  expect(result).toMatchObject({ outcome: "conflict", reason: "branch-moved", files: expected });
});

test("retries once on a branch moved in other files and answers branch-moved after two races", async () => {
  const { fixture, service, request } = await writableService();
  let moved = 0;
  fixture.remote.state.beforeReceive = async () => {
    await appendOtherFile(fixture);
    moved++;
  };
  const result = await service.revisions.save({
    ...request,
    files: [{ path: request.path, text: request.text }],
  });
  expect(moved).toBe(2);
  expect(result).toMatchObject({ outcome: "conflict", reason: "branch-moved" });
  expect(await git.log({ fs, gitdir: fixture.remote.gitdir, ref: "main" })).toHaveLength(3);
  fixture.remote.state.beforeReceive = async () => {
    delete fixture.remote.state.beforeReceive;
    await appendOtherFile(fixture);
  };
  const saved = await service.revisions.save({
    ...request,
    files: [{ path: request.path, text: request.text }],
  });
  expect(saved.outcome).toBe("saved");
  if (saved.outcome === "conflict") throw new Error("Unexpected conflict");
  expect(saved.blueprints?.commit).toBe(saved.commit);
});
test("a retry push accepted with a lost reply is reconciled before branch-moved classification", async () => {
  const { fixture, service, request } = await writableService();
  let receives = 0;
  fixture.remote.state.beforeReceive = async () => {
    receives++;
    if (receives === 1) await appendOtherFile(fixture);
    else fixture.remote.state.loseReceiveReply = true;
  };
  const saved = await service.revisions.save({
    ...request,
    files: [{ path: request.path, text: request.text }],
  });
  expect(saved.outcome).toBe("already-saved");
  expect(receives).toBe(2);
  if (saved.outcome === "conflict") throw new Error("Unexpected conflict");
  expect(saved.blueprints?.commit).toBe(saved.commit);
  expect(
    (await git.log({ fs, gitdir: fixture.remote.gitdir, ref: "main" })).filter((row) =>
      row.commit.message.includes(request.saveId),
    ),
  ).toHaveLength(1);
});
test("a pushed save with a failed follow retains its outcome and a retry loads it", async () => {
  const fixture = await serviceFixture();
  cleanups.push(fixture.close);
  await git.setConfig({
    fs,
    gitdir: fixture.remote.gitdir,
    path: "http.receivepack",
    value: "true",
  });
  const service = await startService({
    configurationFile: fixture.file,
    log: () => {},
    probes: {
      save(step) {
        if (step === "pushed") fixture.remote.state.refuseNextFetch = true;
      },
    },
  });
  cleanups.push(service.stop);
  const text = (await service.processRepository.current()!.read("blueprints/counter.yml"))!.replace(
    "count: 60",
    "count: 61",
  );
  const request = {
    path: "blueprints/counter.yml",
    base: fixture.first,
    text,
    message: "Change counter",
    saveId: "a".repeat(32),
  };
  const saved = await service.revisions.save({
    ...request,
    files: [{ path: request.path, text: request.text }],
  });
  expect(saved).toMatchObject({ outcome: "saved", blueprints: undefined });
  if (saved.outcome === "conflict") throw new Error("Unexpected conflict");
  expect(
    await service.revisions.save({
      ...request,
      files: [{ path: request.path, text: request.text }],
    }),
  ).toMatchObject({
    outcome: "already-saved",
    commit: saved.commit,
    blueprints: { commit: saved.commit },
  });
});

test("an unmoved branch keeps the remote refusal kind and is not pushed again", async () => {
  const { fixture, service, request } = await writableService();
  const { join } = await import("node:path");
  await fs.mkdir(join(fixture.remote.gitdir, "hooks"), { recursive: true });
  await fs.writeFile(
    join(fixture.remote.gitdir, "hooks/pre-receive"),
    '#!/bin/sh\necho "Example policy refusal" >&2\nexit 1\n',
    { mode: 0o755 },
  );
  await expect(
    service.revisions.save({ ...request, files: [{ path: request.path, text: request.text }] }),
  ).rejects.toMatchObject({ kind: "rejected" });
  expect(fixture.remote.requests.filter((r) => r.path.endsWith("/git-receive-pack"))).toHaveLength(
    1,
  );
  expect(await git.resolveRef({ fs, gitdir: fixture.remote.gitdir, ref: "main" })).toBe(
    fixture.first,
  );
});
