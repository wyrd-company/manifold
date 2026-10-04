// ---
// relationships:
//   verifies: [agent-threads, service-assembly]
// ---
import * as fs from "node:fs/promises";
import git from "isomorphic-git";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify } from "yaml";
import { afterEach, expect, test } from "vite-plus/test";
import { startService } from "../service/index.ts";
import type { ServiceLogEntry } from "../service/index.ts";
import { serviceFixture } from "../service/test-fixtures/repository.ts";
import { commandServer } from "./test-fixtures/commands.ts";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
});
async function parcelBlueprint(fixture: Awaited<ReturnType<typeof serviceFixture>>) {
  const gitdir = fixture.remote.gitdir;
  const parent = await git.readCommit({ fs, gitdir, oid: fixture.first });
  const root = await git.readTree({ fs, gitdir, oid: parent.commit.tree });
  const document = {
    machine: {
      id: "parcel",
      initial: "opening",
      context: {},
      states: {
        opening: {
          invoke: {
            id: "opening",
            src: "thread-create",
            input: {
              type: "expression.map",
              params: {
                expression:
                  '{ "project": "project", "title": "Parcel sample", "model": { "instanceId": "provider", "model": "model" } }',
              },
            },
            onDone: { target: "waiting", actions: "follow-thread" },
            onError: "failed",
          },
        },
        waiting: {},
        failed: { type: "final" },
      },
    },
    schemas: {
      input: true,
      context: true,
      output: true,
      events: {},
      actors: { "thread-create": { input: true, output: true } },
    },
  };
  const blob = await git.writeBlob({ fs, gitdir, blob: Buffer.from(stringify(document)) });
  const blueprints = await git.writeTree({
    fs,
    gitdir,
    tree: [{ path: "parcel.yml", type: "blob", mode: "100644", oid: blob }],
  });
  const tree = await git.writeTree({
    fs,
    gitdir,
    tree: root.tree.map((entry) =>
      entry.path === "blueprints" ? { ...entry, oid: blueprints } : entry,
    ),
  });
  const commit = await git.writeCommit({
    fs,
    gitdir,
    commit: {
      ...parent.commit,
      tree,
      parent: [fixture.first],
      message: "Example parcel blueprint",
    },
  });
  await fixture.remote.force(commit);
  return commit;
}
test("ServiceParts wires commands to the real host, source readiness, revision and log", async () => {
  const fixture = await serviceFixture();
  cleanup.push(fixture.close);
  const commit = await parcelBlueprint(fixture);
  const server = await commandServer();
  cleanup.push(() => server.close());
  await writeFile(join(fixture.directory, "t3.token"), "fixture-token");
  await writeFile(
    fixture.file,
    stringify({
      ...fixture.configuration,
      credentials: {
        ...fixture.configuration.credentials,
        writer: { kind: "t3code-token", tokenFile: "t3.token" },
      },
      environments: {
        station: {
          url: server.url,
          credential: "writer",
          reconnect: { initialMs: 1, factor: 2, maxMs: 5, jitter: 0 },
        },
      },
    }),
  );
  let release!: () => void;
  server.hooks.beforeReadModel = () =>
    new Promise<void>((resolve) => {
      release = resolve;
    });
  let dropped = false;
  server.commandHooks.accepted = (command) => {
    if (command.type === "thread.create" && !dropped) {
      dropped = true;
      server.drop();
    }
  };
  const logs: ServiceLogEntry[] = [];
  const service = await startService({
    configurationFile: fixture.file,
    log: (entry) => logs.push(entry),
  });
  cleanup.push(() => service.stop());
  const loaded = await service.blueprints.version({ commit, path: "blueprints/parcel.yml" });
  expect(loaded.status).toBe("loaded");
  if (loaded.status !== "loaded") throw new Error(JSON.stringify(loaded));
  service.actorHost.start({
    actorId: "worker",
    blueprint: loaded.blueprint,
    input: { manifold: { environment: "station", project: "binding" } },
  });
  await expect.poll(() => typeof release).toBe("function");
  expect(server.commands).toHaveLength(0);
  release();
  await expect.poll(() => service.store.loadSnapshot("worker")?.snapshot.value).toBe("waiting");
  expect(server.threads.size).toBe(1);
  const thread = [...server.threads.values()][0]!;
  expect(thread.title).toBe("Parcel sample");
  expect(thread.runtimeMode).toBe("full-access");
  expect(service.actorHost.actorOf("worker")).toEqual({
    manifold: { environment: "station", project: "binding", threads: [thread.id] },
    commit,
  });
  expect(server.commands).toHaveLength(2);
  expect(
    logs.some(
      (entry) =>
        entry.event === "agent-threads-log" && entry.message === "Retrying agent thread command",
    ),
  ).toBe(true);
  await service.stop();
}, 15000);

test("a real hosted actor without an environment cannot dispatch", async () => {
  const fixture = await serviceFixture();
  cleanup.push(fixture.close);
  const commit = await parcelBlueprint(fixture);
  const service = await startService({ configurationFile: fixture.file, log: () => {} });
  cleanup.push(() => service.stop());
  const loaded = await service.blueprints.version({ commit, path: "blueprints/parcel.yml" });
  if (loaded.status !== "loaded") throw new Error(JSON.stringify(loaded));
  service.actorHost.start({ actorId: "worker", blueprint: loaded.blueprint, input: {} });
  await expect.poll(() => service.store.loadSnapshot("worker")?.snapshot.value).toBe("failed");
});
