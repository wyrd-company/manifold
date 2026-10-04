// ---
// relationships:
//   verifies: usage-intake
// ---
import { afterEach, expect, it } from "vite-plus/test";
import { fork } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanups.splice(0).toReversed()) await close();
});
function child(path: URL, args: string[], execArgv: string[] = []) {
  const process = fork(path, args, {
    silent: true,
    execArgv: [
      "--import",
      new URL("./test-fixtures/source-resolver.ts", import.meta.url).href,
      ...execArgv,
    ],
  });
  let errors = "";
  process.stderr!.on("data", (value) => {
    errors += String(value);
  });
  process.stdout!.on("data", () => {});
  const messages: unknown[] = [];
  const pending: {
    match: (message: unknown) => boolean;
    resolve: (message: unknown) => void;
    reject: (error: Error) => void;
  }[] = [];
  process.on("message", (message) => {
    messages.push(message);
    for (const waiter of pending.splice(0)) {
      if (waiter.match(message)) waiter.resolve(message);
      else pending.push(waiter);
    }
  });
  const ended = new Promise<[number | null, NodeJS.Signals | null]>((resolve, reject) => {
    process.once("error", reject);
    process.once("exit", (code, signal) => {
      resolve([code, signal]);
      for (const waiter of pending.splice(0))
        waiter.reject(new Error(`Worker exited (${code},${signal}): ${errors}`));
    });
  });
  cleanups.push(async () => {
    if (process.exitCode === null && process.signalCode === null) process.kill("SIGKILL");
    await ended;
  });
  const message = (match: (value: unknown) => boolean) => {
    const previous = messages.find(match);
    if (previous !== undefined) return Promise.resolve(previous);
    return new Promise<unknown>((resolve, reject) => pending.push({ match, resolve, reject }));
  };
  return {
    process,
    ended,
    message,
    get errors() {
      return errors;
    },
  };
}
const stop = async (process: ChildProcess) => {
  const end = once(process, "exit");
  process.kill("SIGKILL");
  await end;
};
it.each(["inside", "committed", "host-checkpoint"])(
  "SIGKILL at %s replays every call exactly once after both sides resume",
  async (mode) => {
    const dir = await mkdtemp(join(tmpdir(), "usage-recovery-"));
    cleanups.push(() => rm(dir, { recursive: true, force: true }));
    const root = join(dir, "codex");
    await mkdir(join(root, "sessions"), { recursive: true });
    const records = [
      JSON.stringify({
        type: "session_meta",
        timestamp: "2026-01-01T00:00:00Z",
        payload: { id: "session-one", session_id: "session-one", model: "model-a" },
      }),
    ];
    for (let i = 1; i <= 1100; i++)
      records.push(
        JSON.stringify({
          type: "event_msg",
          timestamp: new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString(),
          payload: {
            type: "token_count",
            info: {
              last_token_usage: { input_tokens: 1, output_tokens: 1 },
              total_token_usage: { input_tokens: i, output_tokens: i, total_tokens: i * 2 },
            },
          },
        }),
      );
    await writeFile(join(root, "sessions", "one.jsonl"), records.join("\n") + "\n");
    await mkdir(join(dir, "t3", "userdata"), { recursive: true });
    const t3 = new DatabaseSync(join(dir, "t3", "userdata", "state.sqlite"));
    t3.exec(
      "CREATE TABLE provider_session_runtime (thread_id TEXT,provider_name TEXT,provider_instance_id TEXT,resume_cursor_json TEXT)",
    );
    t3.prepare("INSERT INTO provider_session_runtime VALUES (?,?,?,?)").run(
      "thread-one",
      "codex",
      "instance-one",
      JSON.stringify({ threadId: "session-one" }),
    );
    t3.close();
    const path = join(dir, "store.sqlite");
    async function server(crash: string) {
      const worker = child(new URL("./test-fixtures/receiver.ts", import.meta.url), [
        JSON.stringify({ path, crash }),
      ]);
      const ready = (await worker.message(
        (value) => typeof value === "object" && value !== null && "port" in value,
      )) as { port: number };
      return { ...worker, url: `http://127.0.0.1:${ready.port}` };
    }
    const initial = await server(mode === "host-checkpoint" ? "none" : mode);
    function host(url: string, pause = false) {
      return child(
        new URL("../../../host-cli/src/cli.ts", import.meta.url),
        [
          "usage",
          "push",
          "--service",
          url,
          "--environment",
          "env-one",
          "--token-file",
          join(dir, "operator-token"),
          "--state-dir",
          join(dir, "state"),
          "--t3-home",
          join(dir, "t3"),
          "--root",
          "codex=" + root,
        ],
        pause
          ? ["--import", new URL("./test-fixtures/checkpoint-probe.ts", import.meta.url).href]
          : [],
      );
    }
    await writeFile(join(dir, "operator-token"), "example-token");
    const first = host(initial.url, mode === "host-checkpoint");
    if (mode === "host-checkpoint") {
      await first.message((value) => value === "acknowledged");
      await stop(first.process);
      await stop(initial.process);
    } else {
      await initial.message((value) => value === mode);
      await stop(initial.process);
      expect(await first.ended, first.errors).toEqual([1, null]);
    }
    const intermediate = new DatabaseSync(path, { readOnly: true });
    try {
      expect(intermediate.prepare("SELECT count(*) n FROM usage_calls").get()).toMatchObject({
        n: mode === "inside" ? 1000 : 1100,
      });
    } finally {
      intermediate.close();
    }
    const resumed = await server("none");
    const second = host(resumed.url);
    expect(await second.ended, second.errors).toEqual([0, null]);
    const third = host(resumed.url);
    expect(await third.ended, third.errors).toEqual([0, null]);
    await stop(resumed.process);
    const db = new DatabaseSync(path, { readOnly: true });
    try {
      expect(db.prepare("SELECT count(*) n FROM usage_calls").get()).toMatchObject({ n: 1100 });
      expect(
        db.prepare("SELECT provider_instance,thread_id FROM usage_sessions").get(),
      ).toMatchObject({ provider_instance: "instance-one", thread_id: "thread-one" });
      expect(
        db
          .prepare(
            "SELECT count(*) n FROM usage_postings WHERE actor='actor-one' AND item='alpha' AND visit=1 AND account='acct'",
          )
          .get(),
      ).toMatchObject({ n: 1100 });
      expect(
        db
          .prepare("SELECT count(*) n,sum(amount) amount FROM usage_postings WHERE status='posted'")
          .get(),
      ).toMatchObject({ n: 1100, amount: 11000 });
      expect(
        db
          .prepare(
            "SELECT count(*) n FROM (SELECT ledger_key,count(*) c FROM usage_postings GROUP BY ledger_key HAVING c<>1)",
          )
          .get(),
      ).toMatchObject({ n: 0 });
      expect(
        db.prepare("SELECT count(*) n FROM ledger_entries WHERE kind='actual'").get(),
      ).toMatchObject({ n: 1100 });
    } finally {
      db.close();
    }
  },
  30000,
);
