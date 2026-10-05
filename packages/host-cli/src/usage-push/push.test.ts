// ---
// relationships:
//   verifies: [usage-intake, host-cli-usage]
// ---
import { afterEach, expect, it } from "vite-plus/test";
import { mkdtemp, rm, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { Writable } from "node:stream";
import { createServer } from "node:http";
import { runUsagePush, readSessionMappings } from "./index.ts";
import { decodeUsage, decodeUsageBatches } from "../usage/index.ts";
import type { UsagePushRequest } from "@wyrd-company/manifold-shared";
const cleanups: (() => unknown)[] = [];
afterEach(async () => {
  for (const close of cleanups.splice(0).toReversed()) await close();
});
async function dir() {
  const path = await mkdtemp(join(tmpdir(), "push-test-"));
  cleanups.push(() => rm(path, { force: true, recursive: true }));
  return path;
}
function stream() {
  let text = "";
  return {
    get text() {
      return text;
    },
    writable: new Writable({
      write(chunk, _encoding, done) {
        text += String(chunk);
        done();
      },
    }),
  };
}
it("reads all five provider cursor shapes in process and rejects broken databases", async () => {
  const path = join(await dir(), "state.sqlite");
  expect(readSessionMappings(path)).toEqual([]);
  const db = new DatabaseSync(path);
  db.exec(
    "CREATE TABLE provider_session_runtime (thread_id TEXT, provider_name TEXT, provider_instance_id TEXT, resume_cursor_json TEXT)",
  );
  for (const [provider, cursor] of [
    ["claudeAgent", { resume: "session-c" }],
    ["codex", { threadId: "session-x" }],
    ["cursor", { sessionId: "session-u" }],
    ["grok", { sessionId: "session-g" }],
    ["opencode", { sessionId: "session-o" }],
  ] as const)
    db.prepare("INSERT INTO provider_session_runtime VALUES (?,?,?,?)").run(
      "thread-" + provider,
      provider,
      "instance-" + provider,
      JSON.stringify(cursor),
    );
  db.close();
  expect(readSessionMappings(path)).toHaveLength(5);
  expect(readSessionMappings(path)[0]).toMatchObject({
    provider: "claude",
    providerSessionId: "session-c",
    providerInstance: "instance-claudeAgent",
  });
  const bad = join(await dir(), "bad.sqlite");
  new DatabaseSync(bad).close();
  expect(() => readSessionMappings(bad)).toThrow();
});
it("batches flatten to the unchanged decoder output and skipping omits calls", async () => {
  const roots = [
    {
      provider: "codex" as const,
      path: new URL("../usage/fixtures/codex/", import.meta.url).pathname,
    },
  ];
  const flat = [];
  for await (const batch of decodeUsageBatches(roots)) flat.push(...batch.records);
  const old = [];
  for await (const record of decodeUsage(roots)) old.push(record);
  expect(flat).toEqual(old);
  expect(flat.length).toBeGreaterThan(0);
  const skipped = [];
  for await (const batch of decodeUsageBatches(roots, { skip: () => true }))
    skipped.push(...batch.records);
  expect(skipped).toEqual([]);
});
async function setup(responseBody?: unknown) {
  const home = await dir();
  const requests: UsagePushRequest[] = [];
  const authorization: (string | undefined)[] = [];
  let status = 200;
  const server = createServer(async (req, res) => {
    authorization.push(req.headers.authorization);
    let body = "";
    for await (const chunk of req) body += String(chunk);
    requests.push(JSON.parse(body) as UsagePushRequest);
    res.writeHead(status, { "content-type": "application/json" });
    res.end(
      JSON.stringify(
        responseBody ?? {
          calls: { accepted: requests.at(-1)!.records.length, pending: 0, replayed: 0 },
          threads: { accepted: 0, replayed: 0, conflicting: 0 },
          sourceErrors: 0,
        },
      ),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanups.push(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw Error();
  const out = stream(),
    err = stream();
  const io = {
    stdout: out.writable,
    stderr: err.writable,
    env: {},
    home,
    decoderRevision: "revision-1",
  };
  const args = [
    "--service",
    `http://127.0.0.1:${address.port}`,
    "--environment",
    "env-one",
    "--state-dir",
    join(home, "state"),
    "--t3-home",
    home,
    "--root",
    "codex=" + new URL("../usage/fixtures/codex/", import.meta.url).pathname,
  ];
  return {
    home,
    requests,
    authorization,
    io,
    args,
    out,
    err,
    status: (value: number) => {
      status = value;
    },
  };
}
it("checkpoints acknowledged batches, invalidates by decoder revision and leaves failures retryable", async () => {
  const s = await setup();
  s.status(500);
  expect(await runUsagePush(s.args, s.io)).toBe(1);
  s.status(200);
  expect(await runUsagePush(s.args, s.io)).toBe(0);
  const count = s.requests.length;
  expect(count).toBeGreaterThan(1);
  expect(await runUsagePush(s.args, s.io)).toBe(0);
  expect(s.requests).toHaveLength(count);
  expect(await runUsagePush(s.args, { ...s.io, decoderRevision: "revision-2" })).toBe(0);
  expect(s.requests.length).toBeGreaterThan(count);
});
it("rejects invalid arguments without decoding or sending", async () => {
  const s = await setup();
  expect(await runUsagePush([...s.args, "--unknown", "x"], s.io)).toBe(2);
  expect(await runUsagePush([...s.args, "--token-file", "unused"], s.io)).toBe(2);
  expect(s.requests).toHaveLength(0);
});
it("acknowledges transient database errors without checkpointing the unchanged source", async () => {
  const s = await setup();
  const root = join(s.home, "opencode");
  await mkdir(root);
  const path = join(root, "opencode.db");
  const db = new DatabaseSync(path);
  db.exec(
    await readFile(new URL("../usage/fixtures/opencode/sessions.sql", import.meta.url), "utf8"),
  );
  const stat = await import("node:fs/promises").then((fs) => fs.stat(path));
  db.exec("BEGIN EXCLUSIVE");
  const args = s.args.slice(0, -2).concat(["--root", "opencode=" + root]);
  expect(await runUsagePush(args, s.io)).toBe(0);
  expect(s.requests.flatMap((r) => r.records)).toEqual(
    expect.arrayContaining([expect.objectContaining({ type: "source-error", code: "unreadable" })]),
  );
  db.exec("ROLLBACK");
  db.close();
  expect((await import("node:fs/promises").then((fs) => fs.stat(path))).mtimeMs).toBe(stat.mtimeMs);
  const count = s.requests.length;
  expect(await runUsagePush(args, s.io)).toBe(0);
  expect(
    s.requests
      .slice(count)
      .flatMap((r) => r.records)
      .some((r) => r.type === "call"),
  ).toBe(true);
});
it("stamps dependent files before decode and resends when a transcript grows", async () => {
  const s = await setup();
  const root = join(s.home, "codex");
  await mkdir(join(root, "sessions"), { recursive: true });
  const fixture = await readFile(
    new URL("../usage/fixtures/codex/sessions/root.jsonl", import.meta.url),
    "utf8",
  );
  const path = join(root, "sessions", "root.jsonl");
  await writeFile(path, fixture);
  const args = s.args.slice(0, -2).concat(["--root", "codex=" + root]);
  expect(await runUsagePush(args, s.io)).toBe(0);
  const count = s.requests.length;
  await writeFile(path, fixture + "\n");
  expect(await runUsagePush(args, s.io)).toBe(0);
  expect(s.requests.length).toBeGreaterThan(count);
});

it("embeds the golden decoder revision", async () => {
  const { createHash } = await import("node:crypto");
  const { decoderRevision } = await import("../usage/revision.generated.ts");
  expect(decoderRevision).toBe(
    createHash("sha256")
      .update(await readFile(new URL("../usage/fixtures/expected.jsonl", import.meta.url)))
      .digest("hex"),
  );
});

it("keeps every source retryable when a shared database error is reported only once", async () => {
  const s = await setup();
  const root = join(s.home, "cursor");
  const transcripts = join(root, "projects", "example", "agent-transcripts");
  await mkdir(transcripts, { recursive: true });
  await mkdir(join(root, "ai-tracking"));
  await writeFile(join(transcripts, "one.txt"), "user: Hello\nassistant: Example reply\n");
  await writeFile(join(transcripts, "two.txt"), "user: Hello\nassistant: Another reply\n");
  const path = join(root, "ai-tracking", "ai-code-tracking.db");
  const db = new DatabaseSync(path);
  db.exec(
    "CREATE TABLE conversation_summaries (conversationId TEXT,model TEXT,title TEXT,updatedAt TEXT)",
  );
  const { stat } = await import("node:fs/promises");
  const info = await stat(path);
  db.exec("BEGIN EXCLUSIVE");
  const args = s.args.slice(0, -2).concat(["--root", "cursor=" + root]);
  expect(await runUsagePush(args, s.io)).toBe(0);
  db.exec("ROLLBACK");
  db.close();
  expect((await stat(path)).mtimeMs).toBe(info.mtimeMs);
  const before = s.out.text.length;
  expect(await runUsagePush(args, s.io)).toBe(0);
  expect(JSON.parse(s.out.text.slice(before))).toMatchObject({ skippedSources: 0 });
});

it("contains output stream failures and leaves acknowledged sources checkpointed", async () => {
  const s = await setup();
  const broken = new Writable({
    write(_chunk, _encoding, done) {
      done(new Error("output closed"));
    },
  });
  expect(await runUsagePush(s.args, { ...s.io, stdout: broken })).toBe(1);
  const count = s.requests.length;
  expect(await runUsagePush(s.args, s.io)).toBe(0);
  expect(s.requests).toHaveLength(count);
});

it("rejects malformed acknowledgements without checkpointing sources", async () => {
  const s = await setup({ calls: { accepted: 1 }, threads: { accepted: 0 }, sourceErrors: 0 });
  expect(await runUsagePush(s.args, s.io)).toBe(1);
  const count = s.requests.length;
  expect(await runUsagePush(s.args, s.io)).toBe(1);
  expect(s.requests.length).toBeGreaterThan(count);
});

it("pushes without credentials or Authorization headers", async () => {
  const s = await setup();
  expect(await runUsagePush(s.args, s.io)).toBe(0);
  expect(s.requests.length).toBeGreaterThan(0);
  expect(s.authorization.every((value) => value === undefined)).toBe(true);
});

it("pushes a newly recorded mapping with unchanged sources, acknowledges it, and retries failures", async () => {
  const s = await setup();
  expect(await runUsagePush(s.args, s.io)).toBe(0);
  const count = s.requests.length;
  await mkdir(join(s.home, "userdata"), { recursive: true });
  const db = new DatabaseSync(join(s.home, "userdata", "state.sqlite"));
  db.exec(
    "CREATE TABLE provider_session_runtime (thread_id TEXT, provider_name TEXT, provider_instance_id TEXT, resume_cursor_json TEXT)",
  );
  db.prepare("INSERT INTO provider_session_runtime VALUES (?,?,?,?)").run(
    "thread-1",
    "codex",
    "instance-1",
    JSON.stringify({ threadId: "session-1" }),
  );
  db.close();
  s.status(500);
  expect(await runUsagePush(s.args, s.io)).toBe(1);
  expect(s.requests.at(-1)).toMatchObject({ records: [], threads: [{ threadId: "thread-1" }] });
  s.status(200);
  expect(await runUsagePush(s.args, s.io)).toBe(0);
  expect(s.requests).toHaveLength(count + 2);
  expect(s.requests.at(-1)).toMatchObject({ records: [], threads: [{ threadId: "thread-1" }] });
  expect(await runUsagePush(s.args, s.io)).toBe(0);
  expect(s.requests).toHaveLength(count + 2);
});

it("sends all unacknowledged mappings in batches before decoding and retries changed mappings", async () => {
  const s = await setup();
  await mkdir(join(s.home, "userdata"), { recursive: true });
  const db = new DatabaseSync(join(s.home, "userdata", "state.sqlite"));
  db.exec(
    "CREATE TABLE provider_session_runtime (thread_id TEXT, provider_name TEXT, provider_instance_id TEXT, resume_cursor_json TEXT)",
  );
  const insert = db.prepare("INSERT INTO provider_session_runtime VALUES (?,?,?,?)");
  for (let i = 0; i < 1001; i++)
    insert.run(`thread-${i}`, "codex", "instance-1", JSON.stringify({ threadId: `session-${i}` }));
  expect(await runUsagePush(s.args, s.io)).toBe(0);
  expect(s.requests.slice(0, 2).map((r) => [r.threads.length, r.records.length])).toEqual([
    [1000, 0],
    [1, 0],
  ]);
  expect(
    s.requests
      .slice(0, 2)
      .flatMap((r) => r.threads)
      .map((m) => m.providerSessionId),
  ).toEqual(Array.from({ length: 1001 }, (_, i) => `session-${i}`));
  const count = s.requests.length;
  expect(await runUsagePush(s.args, s.io)).toBe(0);
  expect(s.requests).toHaveLength(count);
  db.exec(
    "UPDATE provider_session_runtime SET provider_instance_id='instance-2' WHERE thread_id='thread-0'",
  );
  expect(await runUsagePush(s.args, s.io)).toBe(0);
  expect(s.requests).toHaveLength(count + 1);
  expect(s.requests.at(-1)).toMatchObject({
    records: [],
    threads: [{ threadId: "thread-0", providerInstance: "instance-2" }],
  });
  db.close();
});
