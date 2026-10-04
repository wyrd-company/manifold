// ---
// relationships:
//   verifies: [agent-threads, durable-event-delivery, t3code-environment-source]
// ---
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fork } from "node:child_process";
import { once } from "node:events";
import { afterEach, expect, test } from "vite-plus/test";
import { commandServer } from "./test-fixtures/commands.ts";
import { fixtureService } from "./test-fixtures/service.ts";
import type { FixtureConfiguration } from "./test-fixtures/service.ts";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
});
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "thread-recovery-"));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  const token = join(directory, "token");
  await writeFile(token, "fixture-token");
  const server = await commandServer();
  cleanup.push(() => server.close());
  const config: FixtureConfiguration = {
    path: join(directory, "store.sqlite"),
    token,
    environments: {
      station: {
        url: server.url,
        credential: "writer",
        reconnect: { initialMs: 1, factor: 2, maxMs: 5, jitter: 0 },
        heartbeat: { intervalMs: 5000, missedPongLimit: 3 },
        openTimeoutMs: 10000,
      },
    },
  };
  return { server, config };
}
test("source readiness precedes a fast turn and settlement before invoke onDone", async () => {
  const { server, config } = await setup();
  let release!: () => void;
  server.hooks.beforeReadModel = () =>
    new Promise<void>((resolve) => {
      release = resolve;
    });
  server.commandHooks.accepted = (command) => {
    if (command.type === "thread.turn.start") server.settle(command.threadId);
  };
  let responseHeld = false;
  server.hooks.beforeDispatchResponse = async (command) => {
    if ((command as { type: string }).type === "thread.turn.start") {
      responseHeld = true;
      await new Promise<void>((resolve) => {
        const subscription = service.actor.subscribe((snapshot) => {
          if (snapshot.status === "done") {
            subscription.unsubscribe();
            resolve();
          }
        });
      });
    }
  };
  const service = fixtureService(config);
  cleanup.push(() => service.stop());
  await expect.poll(() => typeof release).toBe("function");
  expect(server.commands).toHaveLength(0);
  release();
  await expect.poll(() => service.actor.getSnapshot().status).toBe("done");
  expect(responseHeld).toBe(true);
  expect(server.threads.size).toBe(1);
  expect([...server.threads.values()][0]!.messages).toHaveLength(1);
  expect(service.actor.getSnapshot().context.started).toBe(1);
});
test("guard ignores old, other-thread and ambiguous settlements then takes its turn", async () => {
  const { server, config } = await setup();
  const service = fixtureService(config);
  cleanup.push(() => service.stop());
  await expect.poll(() => service.actor.getSnapshot().value).toEqual({ working: "waiting" });
  const context = service.actor.getSnapshot().context;
  for (const [threadId, messageId] of [
    [context.thread, "old-message"],
    ["other", context.message],
    [context.thread, null],
  ]) {
    service.router.publish({
      source: "fixture",
      eventId: `${threadId}:${messageId}`,
      topics: [`t3.environment.station.thread.${context.thread}`],
      event: { type: "t3.turn.settled", threadId, messageId },
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(service.actor.getSnapshot().value).toEqual({ working: "waiting" });
  }
  server.settle(context.thread);
  await expect.poll(() => service.actor.getSnapshot().status).toBe("done");
});
test("dropped response retries the exact command and gives one turn", async () => {
  const { server, config } = await setup();
  let dropped = false;
  server.commandHooks.accepted = (command) => {
    if (command.type === "thread.turn.start" && !dropped) {
      dropped = true;
      server.drop();
    }
  };
  const service = fixtureService(config);
  cleanup.push(() => service.stop());
  await expect.poll(() => service.actor.getSnapshot().value).toEqual({ working: "waiting" });
  const turns = server.commands.filter((command) => command.type === "thread.turn.start");
  expect(turns).toHaveLength(2);
  expect(turns[0]).toEqual(turns[1]);
  expect([...server.threads.values()][0]!.messages).toHaveLength(1);
  server.settle(service.actor.getSnapshot().context.thread);
  await expect.poll(() => service.actor.getSnapshot().status).toBe("done");
});
test.each(["thread-create", "turn-start"] as const)(
  "SIGKILL after %s receipt restores one thread and one turn",
  async (crash) => {
    const { server, config } = await setup();
    function start(crash?: FixtureConfiguration["crash"]) {
      const child = fork(
        new URL("./test-fixtures/crash-worker.ts", import.meta.url),
        [JSON.stringify({ ...config, crash })],
        { execArgv: [], stdio: ["ignore", "pipe", "pipe", "ipc"] },
      );
      let error = "";
      child.stderr?.on("data", (chunk) => {
        error += String(chunk);
      });
      const messages: unknown[] = [];
      child.on("message", (message) => messages.push(message));
      cleanup.push(async () => {
        if (child.exitCode === null && child.signalCode === null) {
          const exited = once(child, "exit");
          child.kill("SIGKILL");
          await exited;
        }
      });
      function waitFor(predicate: (message: unknown) => boolean): Promise<void> {
        if (messages.some(predicate)) return Promise.resolve();
        return new Promise<void>((resolve, reject) => {
          const detach = () => {
            child.off("message", received);
            child.off("exit", exited);
            child.off("error", failed);
          };
          const received = (message: unknown) => {
            if (predicate(message)) {
              detach();
              resolve();
            }
          };
          const exited = (code: number | null, signal: NodeJS.Signals | null) => {
            detach();
            reject(new Error(`Worker exited before expected state (${code}, ${signal}): ${error}`));
          };
          const failed = (cause: Error) => {
            detach();
            reject(cause);
          };
          child.on("message", received);
          child.once("exit", exited);
          child.once("error", failed);
        });
      }
      return { child, waitFor, error: () => error };
    }
    const first = start(crash);
    const [, signal] = await once(first.child, "exit");
    expect(signal, first.error()).toBe("SIGKILL");
    const resumed = start();
    await resumed.waitFor((message) => JSON.stringify(message).includes("waiting"));
    expect(server.commands.filter((command) => command.type === "thread.turn.start")).toHaveLength(
      crash === "turn-start" ? 2 : 1,
    );
    expect(server.threads.size).toBe(1);
    const thread = [...server.threads.values()][0]!;
    expect(thread.messages).toHaveLength(1);
    server.settle(thread.id);
    await resumed.waitFor((message) => JSON.stringify(message).includes('"value":"done"'));
    const exiting = once(resumed.child, "exit");
    resumed.child.send("stop");
    await exiting;
  },
  30000,
);
