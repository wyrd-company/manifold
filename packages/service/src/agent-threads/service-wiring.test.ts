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
import { startService, githubWebhookPath } from "../service/index.ts";
import type { ServiceLogEntry } from "../service/index.ts";
import { serviceFixture } from "../service/test-fixtures/repository.ts";
import { signedDelivery } from "../github-source/test-fixtures/api.ts";
import { commandServer } from "./test-fixtures/commands.ts";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
});
async function parcelBlueprint(
  fixture: Awaited<ReturnType<typeof serviceFixture>>,
  projectCreate = false,
) {
  const gitdir = fixture.remote.gitdir;
  const parent = await git.readCommit({ fs, gitdir, oid: fixture.first });
  const root = await git.readTree({ fs, gitdir, oid: parent.commit.tree });
  const document = {
    machine: {
      id: "parcel",
      initial: projectCreate ? "creating" : "opening",
      context: { workspace: "project" },
      states: {
        creating: {
          invoke: {
            id: "creating",
            src: "t3code-project-create",
            input: {
              type: "expression.map",
              params: {
                expression:
                  '{ "title": "Parcel sample", "workspaceRoot": "/work/sample", "createWorkspaceRoot": true }',
              },
            },
            onDone: {
              target: "opening",
              actions: {
                type: "expression.assign",
                params: { expression: '{ "workspace": event.output.projectId }' },
              },
            },
            onError: "failed",
          },
        },
        opening: {
          invoke: {
            id: "opening",
            src: "thread-create",
            input: {
              type: "expression.map",
              params: {
                expression:
                  '{ "project": context.workspace, "title": "Parcel sample", "model": { "instanceId": "provider", "model": "model" } }',
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
      actors: {
        "t3code-project-create": { input: true, output: true },
        "thread-create": { input: true, output: true },
      },
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
  const commit = await parcelBlueprint(fixture, true);
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
    input: { manifold: { environment: "station", project: "binding", portfolioItem: "beta" } },
  });
  await expect.poll(() => typeof release).toBe("function");
  expect(server.commands).toHaveLength(0);
  service.environments.act("station", "disconnect");
  delete server.hooks.beforeReadModel;
  release();
  await expect.poll(() => service.t3code.status()[0]?.state).toBe("disconnected");
  expect(server.commands).toHaveLength(0);
  service.environments.act("station", "pause");
  service.environments.act("station", "reconnect");
  await expect.poll(() => server.projects.size, { timeout: 15000 }).toBe(1);
  await expect.poll(() => service.agentThreads.scheduled("station")).toBe(1);
  expect(server.commands.map((command) => command.type)).toEqual(["project.create"]);
  expect(service.history.read("worker")!.commands.map((command) => command.kind)).toEqual([
    "project-create",
    "thread-create",
  ]);
  service.environments.act("station", "resume");
  await expect.poll(() => service.store.loadSnapshot("worker")?.snapshot.value).toBe("waiting");
  expect(server.threads.size).toBe(1);
  const thread = [...server.threads.values()][0]!;
  expect(thread.title).toBe("Parcel sample");
  expect(thread.runtimeMode).toBe("full-access");
  expect(service.actorHost.actorOf("worker")).toEqual({
    manifold: {
      environment: "station",
      project: "binding",
      portfolioItem: "beta",
      threads: [thread.id],
    },
    commit,
  });
  expect(server.commands).toHaveLength(3);
  expect(server.projects.size).toBe(1);
  const project = [...server.projects.values()][0]!;
  expect(thread.projectId).toBe(project["id"]);
  expect(
    service.portfolio.t3codeProject({ environment: "station", id: String(project["id"]) }),
  ).toEqual({ item: "beta", via: "created", actorId: "worker" });
  expect(
    logs.some(
      (entry) =>
        entry.event === "agent-threads-log" && entry.message === "Retrying agent thread command",
    ),
  ).toBe(true);
  await service.stop();
});

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

test("thread-create reads an archived binding by Project node id at the current revision", async () => {
  const fixture = await serviceFixture();
  cleanup.push(fixture.close);
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
      environments: { station: { url: server.url, credential: "writer" } },
    }),
  );
  const document = {
    machine: {
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
                  '{"project":"project","title":"Parcel sample","model":{"instanceId":"provider","model":"model"}}',
              },
            },
            onDone: "waiting",
            onError: {
              target: "failed",
              actions: {
                type: "expression.assign",
                params: { expression: '{"failure":event.error}' },
              },
            },
          },
        },
        waiting: {},
        failed: {},
        done: { type: "final" },
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
  const bindings = (archived: boolean) => ({
    githubProjects: {
      parcels: { owner: "sample", number: 1, item: "alpha", environment: "station", archived },
    },
  });
  const active = await fixture.commit(60, { bindings: bindings(false) }, document);
  const service = await startService({ configurationFile: fixture.file, log: () => {} });
  cleanup.push(service.stop);
  await expect.poll(() => service.github.project("P_one")).toBeDefined();
  const loaded = await service.blueprints.version({
    commit: active,
    path: "blueprints/counter.yml",
  });
  if (loaded.status !== "loaded") throw new Error(JSON.stringify(loaded));
  const blueprint = loaded.blueprint;
  function start(actorId: string, project: string) {
    service.actorHost.start({
      actorId,
      blueprint,
      input: { manifold: { environment: "station", project } },
    });
  }
  start("parcel-active", "P_one");
  await expect
    .poll(() => service.store.loadSnapshot("parcel-active")?.snapshot.value)
    .toBe("waiting");
  expect(server.commands).toHaveLength(1);
  const archived = await fixture.commit(60, { bindings: bindings(true) }, document);
  const delivery = signedDelivery("push", {
    ref: "refs/heads/main",
    after: archived,
    deleted: false,
    repository: { clone_url: fixture.remote.url, html_url: fixture.remote.url },
  });
  const { host, port } = service.http.address();
  expect(
    (
      await fetch(`http://${host}:${port}${githubWebhookPath}`, {
        method: "POST",
        headers: delivery.headers,
        body: delivery.body,
      })
    ).status,
  ).toBe(202);
  // Under paired gates, the new revision becomes ready after 1.27 s.
  await expect
    .poll(() => service.revisions.current()?.revision.commit, { timeout: 10000 })
    .toBe(archived);
  start("parcel-archived", "P_one");
  await expect
    .poll(() => service.store.loadSnapshot("parcel-archived")?.snapshot.value)
    .toBe("failed");
  expect(service.store.loadSnapshot("parcel-archived")?.snapshot["context"]).toMatchObject({
    failure: { kind: "archived" },
  });
  expect(server.commands).toHaveLength(1);
  start("parcel-unbound", "P_missing");
  await expect
    .poll(() => service.store.loadSnapshot("parcel-unbound")?.snapshot.value)
    .toBe("waiting");
  expect(server.commands).toHaveLength(2);
});
