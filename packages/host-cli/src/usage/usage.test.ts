// ---
// relationships:
//   verifies: usage-decoder
//   references: usage-record
// ---
import { cp, mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Writable } from "node:stream";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { childArtifacts } from "../../../../test-support/child-process.ts";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parse as parseYaml } from "yaml";
import { beforeAll, afterAll, expect, test } from "vite-plus/test";
import { decodeUsage, defaultUsageRoots, runUsageCommand, type UsageRoot } from "./index.ts";

test("resolves provider homes without reading the environment", () => {
  expect(defaultUsageRoots({}, "/example")).toEqual([
    { provider: "claude", path: "/example/.claude" },
    { provider: "codex", path: "/example/.codex" },
    { provider: "cursor", path: "/example/.cursor" },
    { provider: "grok", path: "/example/.grok" },
    { provider: "opencode", path: "/example/.local/share/opencode" },
  ]);
  expect(
    defaultUsageRoots(
      {
        CLAUDE_CONFIG_DIR: "/a",
        CODEX_HOME: "/b",
        GROK_HOME: "/c",
        OPENCODE_DATA_DIR: "/d",
        XDG_DATA_HOME: "/e",
      },
      "/example",
    ).map((root) => root.path),
  ).toEqual(["/a", "/b", "/example/.cursor", "/c", "/d"]);
  expect(defaultUsageRoots({ XDG_DATA_HOME: "/e" }, "/example").at(-1)?.path).toBe("/e/opencode");
});

test("absent provider directories yield no records", async () => {
  expect(await collect(decodeUsage([{ provider: "codex", path: "/absent-example" }]))).toEqual([]);
});

test("invalid command arguments decode nothing", async () => {
  for (const args of [
    [],
    ["other"],
    ["decode", "--other"],
    ["decode", "--root"],
    ["decode", "--root", "codex"],
    ["decode", "--root", "other=/example"],
    ["decode", "--root", "codex="],
  ]) {
    let stdout = "",
      stderr = "";
    const code = await runUsageCommand(args, {
      stdout: new Writable({
        write(chunk, _encoding, done) {
          stdout += chunk;
          done();
        },
      }),
      stderr: new Writable({
        write(chunk, _encoding, done) {
          stderr += chunk;
          done();
        },
      }),
      env: {},
      home: "/absent-example",
    });
    expect(code).toBe(2);
    expect(stdout).toBe("");
    expect(stderr.length).toBeGreaterThan(0);
  }
});

const fixtures = fileURLToPath(new URL("./fixtures/", import.meta.url));

test("preserves Claude calls, subagent metadata, and aggregated source problems", async () => {
  const records = await collect(decodeUsage([{ provider: "claude", path: `${fixtures}/claude` }]));
  const calls = records.filter((record) => record.type === "call");
  expect(calls.map((call) => call.key)).toEqual([
    "claude/message-a",
    "claude/message-b",
    "claude/message-c",
  ]);
  expect(calls[0]?.tokens).toEqual({
    input: 10,
    output: 4,
    cacheRead: 3,
    cacheWrite: 7,
    cacheWriteOneHour: 2,
    reasoning: 0,
    webSearchRequests: 1,
  });
  expect(calls[1]?.model).toBe("unlisted-model");
  expect(calls[2]?.unit).toEqual({
    id: "worker-a",
    kind: "subagent",
    parentId: "session-a",
    name: "Sample inspection",
    role: "inspector",
  });
  expect(
    records
      .filter((record) => record.type === "source-error")
      .map(({ code, records, firstRecord }) => ({ code, records, firstRecord })),
  ).toEqual([
    { code: "unknown-record", records: 1, firstRecord: 4 },
    { code: "malformed-record", records: 2, firstRecord: 5 },
    { code: "truncated", records: 1, firstRecord: 7 },
  ]);
});

test("orders Codex origins before archived forks and retains child identity", async () => {
  const records = await collect(decodeUsage([{ provider: "codex", path: `${fixtures}/codex` }]));
  const calls = records.filter((record) => record.type === "call");
  expect(calls).toHaveLength(5);
  expect(calls.find((call) => call.unit.id === "root-a")?.key).toBe(
    "codex/codex:root-a:17:12:2:4:1",
  );
  expect(calls.filter((call) => call.unit.id === "fork-a")).toHaveLength(1);
  expect(calls.find((call) => call.unit.id === "child-a")).toMatchObject({
    providerSessionId: "root-a",
    unit: {
      id: "child-a",
      kind: "child-thread",
      parentId: "root-a",
      name: "Helper",
      role: "inspector",
    },
    tokens: { input: 10, output: 4, cacheRead: 2, reasoning: 1 },
  });
  expect(calls.find((call) => call.unit.id === "orphan-a")?.key).toBe(
    "codex/codex:absent-a:68:63:2:4:1",
  );
  expect(calls.find((call) => call.unit.id === "no-model-a")).toMatchObject({
    model: null,
    estimated: true,
  });
});

async function collect<T>(records: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const record of records) {
    expect(validator(record), JSON.stringify(validator.errors)).toBe(true);
    result.push(record);
  }
  return result;
}

let fixtureCopy: string;
const fixtureProviders = ["claude", "codex", "cursor", "grok", "opencode"] as const;
beforeAll(async () => {
  fixtureCopy = await mkdtemp(join(tmpdir(), "usage-fixtures-"));
  await cp(fixtures, fixtureCopy, { recursive: true });
  await mkdir(join(fixtureCopy, "cursor", "acp-sessions", "session-a"), { recursive: true });
  await mkdir(join(fixtureCopy, "cursor", "ai-tracking"), { recursive: true });
  for (const [sql, database] of [
    ["cursor/acp.sql", "cursor/acp-sessions/session-a/store.db"],
    ["cursor/summary.sql", "cursor/ai-tracking/ai-code-tracking.db"],
    ["opencode/sessions.sql", "opencode/opencode.db"],
  ]) {
    const db = new DatabaseSync(join(fixtureCopy, database!));
    try {
      db.exec(await readFile(join(fixtureCopy, sql!), "utf8"));
    } finally {
      db.close();
    }
  }
  // Set a deterministic source timestamp without changing provider records.
  await setTimes(fixtureCopy);
});
afterAll(async () => {
  if (fixtureCopy) await rm(fixtureCopy, { recursive: true, force: true });
});
async function setTimes(path: string) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) await setTimes(child);
    await utimes(child, new Date("2026-01-01T00:01:00Z"), new Date("2026-01-01T00:01:00Z"));
  }
}
function roots(path = fixtureCopy): UsageRoot[] {
  return fixtureProviders.map((provider) => ({ provider, path: join(path, provider) }));
}

test("decodes Cursor summaries and transcripts without a summary row", async () => {
  const records = await collect(decodeUsage(roots().filter((root) => root.provider === "cursor")));
  const calls = records.filter((record) => record.type === "call");
  expect(calls).toHaveLength(6);
  expect(calls.find((call) => call.unit.id === "conversation-a")).toMatchObject({
    model: "sample-model",
    estimated: true,
    timestamp: "2026-01-01T00:00:10.000Z",
  });
  expect(calls.find((call) => call.unit.id === "conversation-b")).toMatchObject({
    estimated: true,
    timestamp: "2026-01-01T00:01:00.000Z",
  });
});

test("decodes Grok as one running session total", async () => {
  const records = await collect(decodeUsage(roots().filter((root) => root.provider === "grok")));
  expect(records).toEqual([
    expect.objectContaining({
      key: "grok/session-g/session-total",
      granularity: "session-total",
      tokens: {
        input: 15,
        output: 5,
        cacheRead: 0,
        cacheWrite: 0,
        cacheWriteOneHour: 0,
        reasoning: 0,
        webSearchRequests: 0,
      },
    }),
  ]);
});

test("decodes OpenCode files, SQLite child units, and session totals", async () => {
  const records = await collect(
    decodeUsage(roots().filter((root) => root.provider === "opencode")),
  );
  expect(records).toHaveLength(3);
  expect(
    records.find((record) => record.type === "call" && record.unit.id === "session-o"),
  ).toMatchObject({
    key: "opencode/opencode:session-o:message-o",
    model: "sample-model",
    granularity: "call",
  });
  expect(
    records.find((record) => record.type === "call" && record.unit.id === "child-db"),
  ).toMatchObject({
    key: "opencode/opencode:child-db:message-db",
    providerSessionId: "session-db",
    unit: { id: "child-db", kind: "subagent", parentId: "session-db", name: "Sample child" },
    tokens: { input: 12, output: 5, cacheRead: 4, cacheWrite: 3, reasoning: 2 },
  });
  expect(
    records.find((record) => record.type === "call" && record.unit.id === "total-db"),
  ).toMatchObject({
    key: "opencode/total-db/session-total",
    granularity: "session-total",
    tokens: { input: 30, output: 10, reasoning: 2, cacheRead: 4, cacheWrite: 3 },
  });
});

const validator = new Ajv2020({ strict: true }).compile(
  parseYaml(
    await readFile(
      new URL("../../../../docs/specifications/usage-record.schema.yml", import.meta.url),
      "utf8",
    ),
  ),
);
function canonical(records: unknown[]): string {
  return (
    records
      .map((record) => JSON.stringify(record).replaceAll(fixtureCopy, "<fixtures>"))
      .join("\n") + "\n"
  );
}
async function expected(): Promise<string> {
  return await readFile(join(fixtures, "expected.jsonl"), "utf8");
}

test("matches golden records and the strict usage schema for all five providers", async () => {
  const records = await collect(decodeUsage(roots()));
  for (const record of records) {
    expect(validator(record), JSON.stringify(validator.errors)).toBe(true);
    if (record.type === "call" && record.tokens)
      expect(record.tokens.cacheWriteOneHour).toBeLessThanOrEqual(record.tokens.cacheWrite);
  }
  expect(canonical(records)).toBe(await expected());
  expect(await collect(decodeUsage(roots()))).toEqual(records);
});

test("deduplicates repeated roots and copied sources across distinct roots", async () => {
  const originalRoots = roots().filter(
    (root) => root.provider === "claude" || root.provider === "codex",
  );
  const single = await collect(decodeUsage(originalRoots));
  expect(await collect(decodeUsage([...originalRoots, ...originalRoots]))).toEqual(single);
  const copy = join(fixtureCopy, "duplicate");
  await cp(join(fixtureCopy, "claude"), join(copy, "claude"), { recursive: true });
  await cp(join(fixtureCopy, "codex"), join(copy, "codex"), { recursive: true });
  const copiedRoots = roots(copy).filter(
    (root) => root.provider === "claude" || root.provider === "codex",
  );
  const doubled = await collect(decodeUsage([...originalRoots, ...copiedRoots]));
  expect(doubled.filter((record) => record.type === "call")).toEqual(
    single.filter((record) => record.type === "call"),
  );
  const keys = doubled.filter((record) => record.type === "call").map((call) => call.key);
  expect(new Set(keys).size).toBe(keys.length);
});

test("keeps the newer Grok and OpenCode totals in either root order", async () => {
  const newer = join(fixtureCopy, "newer");
  await cp(join(fixtureCopy, "grok"), join(newer, "grok"), { recursive: true });
  await mkdir(join(newer, "opencode"), { recursive: true });
  await cp(join(fixtureCopy, "opencode", "opencode.db"), join(newer, "opencode", "opencode.db"));
  const summaryPath = join(newer, "grok/sessions/example/session-g/summary.json");
  const summary = JSON.parse(await readFile(summaryPath, "utf8"));
  summary.updated_at = "2026-01-01T00:00:20Z";
  await writeFile(summaryPath, JSON.stringify(summary));
  await writeFile(
    join(newer, "grok/sessions/example/session-g/updates.jsonl"),
    '{"params":{"_meta":{"totalTokens":10,"promptId":"prompt-a"},"update":{"sessionUpdate":"agent_message_chunk"}}}\n{"params":{"_meta":{"totalTokens":25,"promptId":"prompt-a"},"update":{"sessionUpdate":"agent_message_chunk"}}}\n',
  );
  const db = new DatabaseSync(join(newer, "opencode", "opencode.db"));
  try {
    db.exec(
      "UPDATE session SET tokens_input=50, tokens_output=20 WHERE id='total-db'; UPDATE message SET time_created=1767225640000 WHERE session_id='total-db';",
    );
  } finally {
    db.close();
  }
  const oldRoots = roots().filter(
    (root) => root.provider === "grok" || root.provider === "opencode",
  );
  const newRoots = roots(newer).filter(
    (root) => root.provider === "grok" || root.provider === "opencode",
  );
  for (const order of [
    [...oldRoots, ...newRoots],
    [...newRoots, ...oldRoots],
  ]) {
    const records = await collect(decodeUsage(order));
    const calls = records.filter((record) => record.type === "call");
    expect(new Set(calls.map((call) => call.key)).size).toBe(calls.length);
    const totals = calls.filter((call) => call.granularity === "session-total");
    expect(totals).toHaveLength(2);
    expect(totals.find((call) => call.provider === "grok")).toMatchObject({
      tokens: { input: 25, output: 15 },
      timestamp: "2026-01-01T00:00:20.000Z",
    });
    expect(totals.find((call) => call.provider === "opencode")).toMatchObject({
      tokens: { input: 50, output: 20 },
      timestamp: "2026-01-01T00:00:40.000Z",
    });
  }
});
const execute = promisify(execFile);

test("compiled Bun binary decodes all fixture roots to the golden JSON Lines", async () => {
  const binary = childArtifacts().host;
  const { stdout, stderr } = await execute(binary, [
    "usage",
    "decode",
    ...roots().flatMap((root) => ["--root", `${root.provider}=${root.path}`]),
  ]);
  expect(stderr).toBe("");
  expect(stdout.replaceAll(fixtureCopy, "<fixtures>")).toBe(await expected());
});

test("source errors isolate unreadable and failed sources without losing later calls", async () => {
  const damaged = join(fixtureCopy, "damaged");
  await cp(join(fixtureCopy, "grok"), join(damaged, "grok"), { recursive: true });
  await rm(join(damaged, "grok/sessions/example/session-g/updates.jsonl"));
  await mkdir(join(damaged, "opencode"), { recursive: true });
  await writeFile(join(damaged, "opencode/opencode-broken.db"), "not a database");
  await cp(join(fixtureCopy, "opencode/opencode.db"), join(damaged, "opencode/opencode.db"));
  const db = new DatabaseSync(join(damaged, "opencode/opencode.db"));
  try {
    db.exec("UPDATE message SET time_created=1e30 WHERE session_id='total-db'");
  } finally {
    db.close();
  }
  const records = await collect(
    decodeUsage([
      ...roots(damaged).filter((root) => root.provider === "grok" || root.provider === "opencode"),
      ...roots(),
    ]),
  );
  const errors = records
    .filter((record) => record.type === "source-error")
    .filter((record) => record.source.startsWith(damaged));
  expect(errors.map((error) => error.code)).toEqual(["unreadable", "unreadable", "decoder-failed"]);
  const calls = records.filter((record) => record.type === "call");
  expect(calls.find((call) => call.unit.id === "child-db")?.key).toBe(
    "opencode/opencode:child-db:message-db",
  );
  expect(calls.filter((call) => call.provider === "grok")).toHaveLength(1);
  expect(new Set(calls.map((call) => call.key)).size).toBe(calls.length);
});

test("command writes source errors with success and reports output failure", async () => {
  let stdout = "",
    stderr = "";
  const io = {
    stdout: new Writable({
      write(chunk, _encoding, done) {
        stdout += chunk;
        done();
      },
    }),
    stderr: new Writable({
      write(chunk, _encoding, done) {
        stderr += chunk;
        done();
      },
    }),
    env: {},
    home: "/absent-example",
  };
  expect(
    await runUsageCommand(
      ["decode", ...roots().flatMap((root) => ["--root", `${root.provider}=${root.path}`])],
      io,
    ),
  ).toBe(0);
  expect(stdout.replaceAll(fixtureCopy, "<fixtures>")).toBe(await expected());
  expect(stderr).toBe("");
  const brokenOutput = new Writable({
    write(_chunk, _encoding, done) {
      done(new Error("Output failed"));
    },
  });
  expect(
    await runUsageCommand(["decode", "--root", `claude=${join(fixtureCopy, "claude")}`], {
      ...io,
      stdout: brokenOutput,
    }),
  ).toBe(1);
  expect(stderr).toContain("stopped before completion");
});

test("session-total comparison uses timestamp then sum then token classes", async () => {
  const copy = join(fixtureCopy, "ties");
  await mkdir(join(copy, "opencode"), { recursive: true });
  await cp(join(fixtureCopy, "opencode/opencode.db"), join(copy, "opencode/opencode.db"));
  const db = new DatabaseSync(join(copy, "opencode/opencode.db"));
  try {
    db.exec("UPDATE session SET tokens_input=35, tokens_output=5 WHERE id='total-db'");
  } finally {
    db.close();
  }
  const oldRoot: UsageRoot = { provider: "opencode", path: join(fixtureCopy, "opencode") };
  const newRoot: UsageRoot = { provider: "opencode", path: join(copy, "opencode") };
  for (const order of [
    [oldRoot, newRoot],
    [newRoot, oldRoot],
  ]) {
    const totals = (await collect(decodeUsage(order))).filter(
      (record) => record.type === "call" && record.granularity === "session-total",
    );
    expect(totals).toHaveLength(1);
    expect(totals[0]).toMatchObject({ tokens: { input: 35, output: 5 } });
  }
  const db2 = new DatabaseSync(join(copy, "opencode/opencode.db"));
  try {
    db2.exec("UPDATE session SET tokens_input=29, tokens_output=20 WHERE id='total-db'");
  } finally {
    db2.close();
  }
  for (const order of [
    [oldRoot, newRoot],
    [newRoot, oldRoot],
  ]) {
    const totals = (await collect(decodeUsage(order))).filter(
      (record) => record.type === "call" && record.granularity === "session-total",
    );
    expect(totals).toHaveLength(1);
    expect(totals[0]).toMatchObject({ tokens: { input: 29, output: 20 } });
  }
});

test("replayed OpenCode message calls do not turn into a session total", async () => {
  const copy = join(fixtureCopy, "message-totals");
  await mkdir(join(copy, "opencode"), { recursive: true });
  await cp(join(fixtureCopy, "opencode/opencode.db"), join(copy, "opencode/opencode.db"));
  const db = new DatabaseSync(join(copy, "opencode/opencode.db"));
  try {
    db.exec("UPDATE session SET tokens_input=12, tokens_output=5 WHERE id='child-db'");
  } finally {
    db.close();
  }
  const clean = join(copy, "clean");
  await mkdir(clean, { recursive: true });
  await cp(join(fixtureCopy, "opencode/opencode.db"), join(clean, "opencode.db"));
  const records = await collect(
    decodeUsage([
      { provider: "opencode", path: join(copy, "opencode") },
      { provider: "opencode", path: clean },
    ]),
  );
  const reversed = await collect(
    decodeUsage([
      { provider: "opencode", path: clean },
      { provider: "opencode", path: join(copy, "opencode") },
    ]),
  );
  for (const decoded of [records, reversed])
    expect(
      decoded.filter((record) => record.type === "call" && record.unit.id === "child-db"),
    ).toHaveLength(1);
});

test("OpenCode nested file subagents retain their root provider session", async () => {
  const nested = join(fixtureCopy, "nested");
  const root = join(nested, "storage/session/example");
  await mkdir(root, { recursive: true });
  for (const session of [
    { id: "outer" },
    { id: "middle", parentID: "outer" },
    { id: "inner", parentID: "middle" },
  ])
    await writeFile(join(root, `${session.id}.json`), JSON.stringify(session));
  await mkdir(join(nested, "storage/message/inner"), { recursive: true });
  await writeFile(
    join(nested, "storage/message/inner/msg.json"),
    '{"id":"msg","role":"assistant","model":"sample-model","tokens":{"input":10},"time":{"created":1767225610000}}',
  );
  const records = await collect(decodeUsage([{ provider: "opencode", path: nested }]));
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    providerSessionId: "outer",
    unit: { id: "inner", kind: "subagent", parentId: "middle" },
  });
});

test("a Cursor database without the summary table reports that database once", async () => {
  const copy = join(fixtureCopy, "broken-cursor");
  await cp(join(fixtureCopy, "cursor"), copy, { recursive: true });
  const database = join(copy, "ai-tracking/ai-code-tracking.db");
  const db = new DatabaseSync(database);
  try {
    db.exec("DROP TABLE conversation_summaries");
  } finally {
    db.close();
  }
  expect(
    (await collect(decodeUsage([{ provider: "cursor", path: copy }]))).filter(
      (record) => record.type === "source-error",
    ),
  ).toEqual([
    { type: "source-error", provider: "cursor", source: database, code: "unreadable", records: 1 },
  ]);
});

test("Claude spawn links select the immediate subagent parent", async () => {
  const copy = join(fixtureCopy, "nested-claude");
  await cp(join(fixtureCopy, "claude"), copy, { recursive: true });
  const directory = join(copy, "projects/example/session-a/subagents");
  const outer = join(directory, "agent-worker-a.jsonl");
  const spawn = {
    type: "user",
    sessionId: "session-a",
    isSidechain: true,
    message: {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "spawn-inner", content: "Done" }],
    },
    toolUseResult: { agentId: "zz-inner", content: "Done" },
  };
  await writeFile(outer, (await readFile(outer, "utf8")) + JSON.stringify(spawn) + "\n");
  await writeFile(
    join(directory, "agent-zz-inner.jsonl"),
    '{"type":"user","sessionId":"session-a","isSidechain":true,"message":{"role":"user","content":"Inspect a sample."}}\n{"type":"assistant","sessionId":"session-a","isSidechain":true,"timestamp":"2026-01-01T00:00:10Z","message":{"id":"message-inner","model":"sample-model","usage":{"input_tokens":1,"output_tokens":1}}}\n',
  );
  const records = await collect(decodeUsage([{ provider: "claude", path: copy }]));
  expect(
    records.find((record) => record.type === "call" && record.unit.id === "zz-inner"),
  ).toMatchObject({ unit: { parentId: "worker-a", kind: "subagent" } });
});

test("invalid token counts are reported while valid calls survive", async () => {
  const copy = join(fixtureCopy, "invalid-counts");
  await cp(join(fixtureCopy, "codex"), copy, { recursive: true });
  const path = join(copy, "sessions/root.jsonl");
  const invalid = {
    type: "event_msg",
    payload: {
      type: "token_count",
      info: { last_token_usage: { input_tokens: -10 }, total_token_usage: { total_tokens: 100 } },
    },
  };
  await writeFile(path, (await readFile(path, "utf8")) + JSON.stringify(invalid) + "\n");
  const records = await collect(decodeUsage([{ provider: "codex", path: copy }]));
  expect(records.filter((record) => record.type === "source-error")).toEqual([
    {
      type: "source-error",
      provider: "codex",
      source: path,
      code: "malformed-record",
      records: 1,
      firstRecord: 2,
    },
  ]);
  expect(records.filter((record) => record.type === "call")).toHaveLength(5);
});

test("pins the decoder dependency exactly", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8"),
  );
  expect(manifest.dependencies["@codeburn/core"]).toBe("0.9.20");
});

test("malformed model and speed fields do not discard valid calls", async () => {
  const copy = join(fixtureCopy, "invalid-models");
  await cp(join(fixtureCopy, "claude"), join(copy, "claude"), { recursive: true });
  await cp(join(fixtureCopy, "codex"), join(copy, "codex"), { recursive: true });
  await cp(join(fixtureCopy, "opencode"), join(copy, "opencode"), { recursive: true });
  await cp(join(fixtureCopy, "grok"), join(copy, "grok"), { recursive: true });
  await writeFile(
    join(copy, "grok/sessions/example/session-g/summary.json"),
    '{"info":{"id":"session-g"},"current_model_id":123}',
  );
  const claudeFile = join(copy, "claude/projects/example/session-a.jsonl");
  let transcript = await readFile(claudeFile, "utf8");
  transcript = transcript.slice(0, transcript.lastIndexOf("\n") + 1);
  for (const [id, model, speed] of [
    ["bad-model", 123, "standard"],
    ["bad-speed", "sample-model", "invalid"],
  ])
    transcript +=
      JSON.stringify({
        type: "assistant",
        message: { id, model, usage: { input_tokens: 1, output_tokens: 1, speed } },
      }) + "\n";
  await writeFile(claudeFile, transcript);
  const codexFile = join(copy, "codex/sessions/root.jsonl");
  await writeFile(
    codexFile,
    (await readFile(codexFile, "utf8")) + '{"type":"turn_context","payload":{"model":123}}\n',
  );
  await writeFile(
    join(copy, "opencode/storage/message/session-o/bad.json"),
    '{"id":"bad","role":"assistant","modelID":123,"tokens":{"input":1},"time":{"created":1767225610000}}',
  );
  const records = await collect(
    decodeUsage(
      roots(copy).filter((root) => ["claude", "codex", "grok", "opencode"].includes(root.provider)),
    ),
  );
  const calls = records.filter((record) => record.type === "call");
  expect(calls).toHaveLength(14);
  expect(calls.find((call) => call.key.includes("bad-model"))).toMatchObject({
    model: null,
    tokens: { input: 1, output: 1 },
  });
  expect(calls.find((call) => call.key.includes("bad-speed"))).toBeUndefined();
  expect(calls.find((call) => call.key === "opencode/opencode:session-o:bad")).toMatchObject({
    model: null,
    tokens: { input: 1 },
  });
  expect(calls.find((call) => call.provider === "grok")).toMatchObject({
    model: null,
    granularity: "session-total",
    tokens: { input: 15, output: 5 },
  });
  expect(
    records
      .filter((record) => record.type === "source-error")
      .map((error) => [error.provider, error.code, error.records]),
  ).toEqual([
    ["claude", "unknown-record", 1],
    ["claude", "malformed-record", 4],
    ["codex", "malformed-record", 1],
    ["grok", "malformed-record", 1],
    ["opencode", "malformed-record", 1],
  ]);
});

test("Claude retains calls without message ids", async () => {
  const root = join(fixtureCopy, "claude-no-id");
  await mkdir(join(root, "projects"), { recursive: true });
  await writeFile(
    join(root, "projects/sample.jsonl"),
    JSON.stringify({
      type: "assistant",
      timestamp: "2026-01-01T00:00:00Z",
      message: { model: "sample-model", usage: { input_tokens: 7, output_tokens: 2 } },
    }) + "\n",
  );
  const records = await collect(decodeUsage([{ provider: "claude", path: root }]));
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    type: "call",
    key: "claude/claude:2026-01-01T00:00:00Z",
    tokens: { input: 7, output: 2 },
  });
});

test.each(["model", "model_name"])(
  "Codex retains metadata and counts with malformed %s",
  async (field) => {
    const root = join(fixtureCopy, "codex-malformed-" + field);
    await mkdir(join(root, "sessions"), { recursive: true });
    await writeFile(
      join(root, "sessions/sample.jsonl"),
      [
        {
          type: "session_meta",
          payload: {
            id: "child-sample",
            session_id: 123,
            model: 123,
            parent_thread_id: "parent-sample",
            agent_nickname: "Sample",
            agent_role: "helper",
          },
        },
        {
          type: "event_msg",
          timestamp: "2026-01-01T00:00:00Z",
          payload: {
            type: "token_count",
            info: {
              [field]: 123,
              last_token_usage: { input_tokens: 7, output_tokens: 2 },
              total_token_usage: { input_tokens: 7, output_tokens: 2, total_tokens: 9 },
            },
          },
        },
      ]
        .map((record) => JSON.stringify(record))
        .join("\n") + "\n",
    );
    const records = await collect(decodeUsage([{ provider: "codex", path: root }]));
    expect(records.filter((record) => record.type === "call")).toEqual([
      expect.objectContaining({
        model: null,
        providerSessionId: "child-sample",
        unit: {
          id: "child-sample",
          kind: "child-thread",
          parentId: "parent-sample",
          name: "Sample",
          role: "helper",
        },
        tokens: expect.objectContaining({ input: 7, output: 2 }),
      }),
    ]);
    expect(records.find((record) => record.type === "source-error")).toMatchObject({
      code: "malformed-record",
      records: 2,
      firstRecord: 0,
    });
  },
);

test("provider groups follow first root appearance and retain shared deduplication", async () => {
  const ordered = roots(fixtureCopy).toReversed();
  ordered.push(ordered[0]!);
  const records = await collect(decodeUsage(ordered));
  expect([...new Set(records.map((record) => record.provider))]).toEqual(
    ordered.slice(0, -1).map((root) => root.provider),
  );
  expect(records.filter((record) => record.type === "call")).toHaveLength(18);
});

test.each(["primaryModelId", "modelsUsed"])(
  "Grok retains totals with malformed signals %s",
  async (field) => {
    const root = join(fixtureCopy, "grok-malformed-" + field);
    await cp(join(fixtureCopy, "grok"), root, { recursive: true });
    const directory = join(root, "sessions/example/session-g");
    await writeFile(join(directory, "summary.json"), JSON.stringify({ info: { id: "session-g" } }));
    await writeFile(
      join(directory, "signals.json"),
      JSON.stringify({ [field]: field === "modelsUsed" ? [123] : 123 }),
    );
    const records = await collect(decodeUsage([{ provider: "grok", path: root }]));
    expect(records.find((record) => record.type === "call")).toMatchObject({
      model: null,
      tokens: { input: 15, output: 5 },
    });
    expect(records.find((record) => record.type === "source-error")).toMatchObject({
      code: "malformed-record",
      records: 1,
    });
  },
);

test("Codex malformed turn context cannot poison a later call model", async () => {
  const root = join(fixtureCopy, "codex-invalid-context");
  await cp(join(fixtureCopy, "codex"), root, { recursive: true });
  const path = join(root, "sessions/root.jsonl");
  await writeFile(
    path,
    (await readFile(path, "utf8")) +
      [
        { type: "turn_context", payload: { model: 123 } },
        {
          type: "event_msg",
          timestamp: "2026-01-01T00:00:20Z",
          payload: {
            type: "token_count",
            info: {
              last_token_usage: { input_tokens: 7, output_tokens: 2 },
              total_token_usage: { input_tokens: 17, output_tokens: 6, total_tokens: 26 },
            },
          },
        },
      ]
        .map((record) => JSON.stringify(record))
        .join("\n") +
      "\n",
  );
  const records = await collect(decodeUsage([{ provider: "codex", path: root }]));
  expect(records.filter((record) => record.type === "call" && record.unit.id === "root-a")).toEqual(
    [
      expect.objectContaining({ model: "sample-model" }),
      expect.objectContaining({
        model: "sample-model",
        tokens: expect.objectContaining({ input: 7, output: 2 }),
      }),
    ],
  );
});
