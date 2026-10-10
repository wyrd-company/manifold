// ---
// relationships:
//   verifies: usage-intake
// ---
import { afterEach, expect, it } from "vite-plus/test";
import { fork } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanups.splice(0).toReversed()) await close();
});
it.each(["move", "ownership"])(
  "SIGKILL inside %s commits no partial attribution, then replay attributes once",
  async (kind) => {
    const dir = await mkdtemp(join(tmpdir(), "usage-reattribution-"));
    cleanups.push(() => rm(dir, { recursive: true, force: true }));
    const path = join(dir, "store.sqlite");
    async function server(crash: boolean) {
      const worker = fork(
        new URL("./test-fixtures/reattribution-receiver.ts", import.meta.url),
        [JSON.stringify({ path, crash })],
        {
          silent: true,
          execArgv: [
            "--import",
            new URL("./test-fixtures/source-resolver.ts", import.meta.url).href,
          ],
        },
      );
      let errors = "";
      worker.stderr!.on("data", (value) => {
        errors += String(value);
      });
      worker.stdout!.on("data", () => {});
      const messages: unknown[] = [];
      const pending: {
        match: (v: unknown) => boolean;
        resolve: (v: unknown) => void;
        reject: (e: Error) => void;
      }[] = [];
      worker.on("message", (value) => {
        messages.push(value);
        for (const waiter of pending.splice(0)) {
          if (waiter.match(value)) waiter.resolve(value);
          else pending.push(waiter);
        }
      });
      const ended = new Promise((resolve, reject) => {
        worker.once("error", reject);
        worker.once("exit", (code, signal) => {
          resolve([code, signal]);
          for (const waiter of pending.splice(0)) waiter.reject(Error(`Worker ended: ${errors}`));
        });
      });
      const stop = async () => {
        if (worker.exitCode === null && worker.signalCode === null) worker.kill("SIGKILL");
        await ended;
      };
      cleanups.push(stop);
      const message = (match: (v: unknown) => boolean) => {
        const found = messages.find(match);
        return found === undefined
          ? new Promise<unknown>((resolve, reject) => pending.push({ match, resolve, reject }))
          : Promise.resolve(found);
      };
      const ready = (await message((v) => typeof v === "object" && v !== null && "port" in v)) as {
        port: number;
      };
      const url = `http://127.0.0.1:${ready.port}`;
      return {
        stop,
        message,
        post: (route: string, body: unknown) =>
          fetch(url + route, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          }),
      };
    }
    const first = await server(true);
    const thread = kind === "move" ? "thread-2" : "thread-1";
    expect(
      (
        await first.post("/api/usage/push", {
          environment: "env-one",
          threads: [{ provider: "codex", providerSessionId: "session-1", threadId: thread }],
          records: [1, 2].map((n) => ({
            type: "call",
            key: `call-${n}`,
            provider: "codex",
            providerSessionId: "session-1",
            unit: { id: "session-1", kind: "session" },
            timestamp: new Date(100).toISOString(),
            model: "model-a",
            speed: "standard",
            granularity: "call",
            estimated: false,
            tokens: {
              input: 1,
              output: 1,
              cacheRead: 0,
              cacheWrite: 0,
              cacheWriteOneHour: 0,
              reasoning: 0,
              webSearchRequests: 0,
            },
          })),
        })
      ).status,
    ).toBe(200);
    const route = kind === "move" ? "/api/usage/moves" : "/fixture/save";
    const body =
      kind === "move"
        ? { from: `thread:env-one:${thread}`, to: { item: "alpha" } }
        : {
            actorId: "actor-1",
            snapshot: {
              status: "active",
              value: "working",
              context: {
                manifold: { environment: "env-one", portfolioItem: "alpha", threads: [thread] },
              },
            },
          };
    const interrupted = first.post(route, body).catch(() => undefined);
    await first.message((v) => v === "inside");
    await first.stop();
    await interrupted;
    const inspect = () => {
      const db = new DatabaseSync(path, { readOnly: true });
      try {
        return {
          reattributions: db.prepare("SELECT count(*) n FROM usage_reattributions").get(),
          operations: db
            .prepare("SELECT count(*) n FROM ledger_operations WHERE kind='reattribute'")
            .get(),
          ownership: db.prepare("SELECT count(*) n FROM usage_threads").get(),
        };
      } finally {
        db.close();
      }
    };
    expect(inspect()).toEqual({
      reattributions: { n: 0 },
      operations: { n: 0 },
      ownership: { n: 0 },
    });
    const resumed = await server(false);
    const answer = await resumed.post(route, body);
    expect(answer.status).toBe(200);
    if (kind === "move")
      expect(await answer.json()).toMatchObject({ moved: 2, accounts: [{ amount: 20 }] });
    const replay = await resumed.post(route, body);
    expect(replay.status).toBe(200);
    if (kind === "move") expect(await replay.json()).toMatchObject({ moved: 0 });
    await resumed.stop();
    expect(inspect()).toEqual({
      reattributions: { n: 2 },
      operations: { n: kind === "move" ? 2 : 0 },
      ownership: { n: kind === "ownership" ? 1 : 0 },
    });
  },
);
