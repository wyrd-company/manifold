// ---
// relationships:
//   verifies: [agent-threads, service-assembly]
// ---
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createActor, toPromise } from "xstate";
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
test("ServiceParts wires thread commands to host identity, source readiness, revision and log", async () => {
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
    actorHost: (parts) => {
      expect(Object.keys(parts.agentThreads.implementations.actors)).toEqual([
        "thread-create",
        "turn-prepare",
        "turn-start",
      ]);
      return {
        subscription: () => ({ topics: [] }),
        restore: () => ({ status: "held", reason: "fixture" }),
        actorOf: () => ({
          manifold: { environment: "station", project: "binding" },
          commit: parts.processRepository.current()!.commit,
        }),
        invocationOf: (args) => ({
          actorId: "worker",
          invokeId: args.self.id,
          entryId: "entry-one",
        }),
      };
    },
  });
  cleanup.push(() => service.stop());
  const actor = createActor(service.agentThreads.implementations.actors["thread-create"]!, {
    input: {
      project: "project",
      title: "Parcel {{ parcel }}",
      values: { parcel: "sample" },
      model: { instanceId: "provider", model: "model" },
      runtimeMode: "approval-required",
    },
  });
  const result = toPromise(actor);
  actor.start();
  await expect.poll(() => typeof release).toBe("function");
  expect(server.commands).toHaveLength(0);
  release();
  await result;
  expect(server.threads.size).toBe(1);
  expect([...server.threads.values()][0]!.title).toBe("Parcel sample");
  expect(server.commands).toHaveLength(2);
  expect(
    logs.some(
      (entry) =>
        entry.event === "agent-threads-log" && entry.message === "Retrying agent thread command",
    ),
  ).toBe(true);
  await service.stop();
  const stopped = createActor(service.agentThreads.implementations.actors["thread-create"]!, {
    input: {
      project: "project",
      title: "Parcel",
      model: { instanceId: "provider", model: "model" },
      runtimeMode: "approval-required",
    },
  });
  const failed = expect(toPromise(stopped)).rejects.toBeDefined();
  stopped.start();
  await failed;
  expect(server.commands).toHaveLength(2);
}, 15000);

test("service without the actor identity seam fails a command with environment", async () => {
  const fixture = await serviceFixture();
  cleanup.push(fixture.close);
  const service = await startService({ configurationFile: fixture.file, log: () => {} });
  cleanup.push(() => service.stop());
  const actor = createActor(service.agentThreads.implementations.actors["thread-create"]!, {
    input: {
      project: "project",
      title: "Parcel",
      model: { instanceId: "provider", model: "model" },
      runtimeMode: "approval-required",
    },
  });
  const failed = expect(toPromise(actor)).rejects.toMatchObject({
    name: "AgentThreadError",
    kind: "environment",
  });
  actor.start();
  await failed;
});
