// ---
// relationships:
//   verifies: usage-decoder
// ---
import { afterEach, expect, test } from "vite-plus/test";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decodeUsage } from "./index.ts";
const paths: string[] = [];
afterEach(async () => {
  for (const path of paths.splice(0)) await rm(path, { recursive: true, force: true });
});
async function fixture(extra = "") {
  const root = await mkdtemp(join(tmpdir(), "cursor-acp-"));
  paths.push(root);
  await mkdir(join(root, "acp-sessions", "session-a"), { recursive: true });
  const db = new DatabaseSync(join(root, "acp-sessions/session-a/store.db"));
  db.exec(await readFile(new URL("./fixtures/cursor/acp.sql", import.meta.url), "utf8"));
  if (extra) db.exec(extra);
  db.close();
  return root;
}
async function records(root: string) {
  const result = [];
  for await (const record of decodeUsage([{ provider: "cursor", path: root }])) result.push(record);
  return result;
}
test("ACP blobs retain call identity, model and tool time without token estimates", async () => {
  const root = await fixture();
  const decoded = await records(root);
  expect(decoded).toHaveLength(4);
  expect(decoded).toEqual(
    [1, 2, 3, 4].map((n) =>
      expect.objectContaining({
        type: "call",
        key: `cursor/session-a/${String(n).padStart(64, "0")}`,
        providerSessionId: "session-a",
        unit: { id: "session-a", kind: "session" },
        tokens: null,
      }),
    ),
  );
  expect(decoded[0]).toMatchObject({
    model: "sample-model",
    timestamp: "2026-01-01T00:00:01.000Z",
    estimated: false,
  });
  expect(decoded[1]).toMatchObject({
    model: "other-model",
    timestamp: "2026-01-01T00:00:03.000Z",
    estimated: false,
  });
  expect(decoded[2]).toMatchObject({
    model: "sample-model",
    timestamp: "2026-01-01T00:00:04.000Z",
    estimated: true,
  });
  expect(decoded[3]).toMatchObject({
    model: null,
    timestamp: "2026-01-01T00:00:06.000Z",
    estimated: true,
  });
  expect(await records(root)).toEqual(decoded);
});
function varint(value: number) {
  const bytes = [];
  let remaining = BigInt(value);
  while (remaining > 127n) {
    bytes.push(Number(remaining & 127n) | 128);
    remaining >>= 7n;
  }
  return Buffer.from([...bytes, Number(remaining)]);
}
function field(number: number, value: number | Uint8Array) {
  return typeof value === "number"
    ? Buffer.concat([varint(number * 8), varint(value)])
    : Buffer.concat([varint(number * 8 + 2), varint(value.length), value]);
}
const id = (n: number) => n.toString(16).padStart(64, "0");
function state(refs: number[], at: number) {
  return Buffer.concat([...refs.map((n) => field(1, Buffer.from(id(n), "hex"))), field(26, at)]);
}
function insert(n: number, value: unknown) {
  const bytes = value instanceof Uint8Array ? value : Buffer.from(JSON.stringify(value));
  return `INSERT INTO blobs VALUES ('${id(n)}',X'${Buffer.from(bytes).toString("hex")}');`;
}
test("append, compaction, tied anchors and restart keep every earlier call unchanged", async () => {
  const root = await fixture();
  const original = await records(root);
  const db = new DatabaseSync(join(root, "acp-sessions/session-a/store.db"));
  try {
    db.exec(insert(22, state([1, 2, 3], 1767225608000)));
    expect(await records(root)).toEqual(original);
    db.exec(
      insert(5, { role: "assistant", content: [] }) +
        insert(23, state([1, 2, 3, 4, 5], 1767225610000)),
    );
    db.exec(insert(24, state([3, 4, 5], 1767225610000)));
    const appended = await records(root);
    expect(appended.slice(0, 4)).toEqual(original);
    expect(appended).toHaveLength(5);
    expect(await records(root)).toEqual(appended);
  } finally {
    db.close();
  }
});
test.each([
  ["role", insert(50, { role: "future", content: [] }), "unknown-record", 4],
  ["content", insert(50, { role: "assistant", content: null }), "malformed-record", 4],
  [
    "tool times",
    `DELETE FROM blobs WHERE id='${id(10)}';` +
      insert(
        10,
        field(
          2,
          Buffer.concat([
            field(57, Buffer.from("tool-a")),
            field(61, 1767225601000),
            field(62, 1767225602000),
          ]),
        ),
      ),
    "unknown-record",
    4,
  ],
  ["wire field", insert(50, field(7, 1)), "unknown-record", 4],
  ["unreferenced bytes", insert(50, Buffer.from([255, 255])), "malformed-record", 4],
  [
    "state time",
    insert(
      50,
      Buffer.concat([field(1, Buffer.from(id(1), "hex")), field(26, Buffer.from("time"))]),
    ),
    "unknown-record",
    4,
  ],
  ["missing reference", insert(50, state([90], 1767225600000)), "malformed-record", 4],
  ["no anchor", insert(50, { role: "assistant", content: [] }), "malformed-record", 4],
] as const)(
  "ACP diagnoses %s while preserving unaffected calls",
  async (_name, sql, code, count) => {
    const decoded = await records(await fixture(sql));
    expect(decoded.filter((r) => r.type === "call")).toHaveLength(count);
    expect(decoded.filter((r) => r.type === "source-error")).toEqual([
      expect.objectContaining({ code, firstRecord: expect.any(Number) }),
    ]);
  },
);
test("a missing tool time uses a valid ending state and stays visible", async () => {
  const root = await fixture(
    `DELETE FROM blobs WHERE id='${id(10)}';` + insert(17, state([1], 1767225600900)),
  );
  expect(await records(root)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        key: `cursor/session-a/${id(1)}`,
        timestamp: "2026-01-01T00:00:00.900Z",
        estimated: true,
      }),
      expect.objectContaining({ type: "source-error", code: "unknown-record" }),
    ]),
  );
});
test("unreadable ACP databases isolate sources", async () => {
  const root = await fixture("DROP TABLE blobs");
  expect(await records(root)).toEqual([
    expect.objectContaining({ type: "source-error", code: "unreadable" }),
  ]);
});
test("nested txt and jsonl transcripts, integer summaries and partial appends remain unmetered", async () => {
  const root = await fixture();
  const { writeFile } = await import("node:fs/promises");
  const path = join(root, "projects/example/agent-transcripts/conversation-a");
  await mkdir(path, { recursive: true });
  await writeFile(
    join(path, "conversation-a.txt"),
    "user:\n<user_query>.</user_query>\nA:\nSample response.\n",
  );
  await writeFile(
    join(path, "conversation-b.jsonl"),
    '{"role":"user","message":{"content":"."}}\n{"role":"assistant","message":{"content":[{"type":"text","text":"Sample response."}]}}\n{"type":"turn_ended"}\n{"role":"turn_ended"}\n{"role":',
  );
  await mkdir(join(root, "ai-tracking"));
  const db = new DatabaseSync(join(root, "ai-tracking/ai-code-tracking.db"));
  db.exec(
    "CREATE TABLE conversation_summaries (conversationId TEXT,model TEXT,title TEXT,updatedAt INTEGER); INSERT INTO conversation_summaries VALUES ('conversation-a','sample-model',NULL,1767225610000)",
  );
  db.close();
  const decoded = await records(root);
  expect(decoded.find((r) => r.type === "call" && r.unit.id === "conversation-a")).toMatchObject({
    tokens: null,
    model: "sample-model",
    timestamp: "2026-01-01T00:00:10.000Z",
    estimated: true,
  });
  expect(decoded.find((r) => r.type === "call" && r.unit.id === "conversation-b")).toMatchObject({
    tokens: null,
    model: null,
    estimated: true,
  });
  expect(decoded.filter((record) => record.type === "source-error")).toEqual([
    expect.objectContaining({ type: "source-error", code: "truncated" }),
  ]);
});
test("fresh decode selects the fewest references before the least anchor id", async () => {
  const root = await fixture(
    insert(22, state([3], 1767225607000)) + insert(23, state([3], 1767225608000)),
  );
  expect(
    (await records(root)).find((r) => r.type === "call" && r.key.endsWith(id(3))),
  ).toMatchObject({ timestamp: "2026-01-01T00:00:07.000Z", estimated: true });
});
test("wire bounds and fixed width fields distinguish recognized records from incomplete data", async () => {
  const fixed = Buffer.concat([
    varint(4 * 8 + 1),
    Buffer.alloc(8),
    varint(5 * 8 + 5),
    Buffer.alloc(4),
  ]);
  const root = await fixture(
    insert(50, fixed) +
      insert(51, Buffer.from([0, 1])) +
      insert(52, Buffer.from([10, 32, 1])) +
      insert(53, Buffer.from([128])),
  );
  expect((await records(root)).filter((r) => r.type === "source-error")).toEqual([
    expect.objectContaining({ code: "malformed-record", records: 3 }),
  ]);
});
test("copied ACP stores deduplicate calls across roots", async () => {
  const root = await fixture();
  const copy = await fixture();
  const result = [];
  for await (const batch of decodeUsage([
    { provider: "cursor", path: root },
    { provider: "cursor", path: copy },
  ]))
    result.push(batch);
  expect(result).toEqual(await records(root));
});
test("ACP batch stamps only its store and committed WAL and skip does not decode it", async () => {
  const root = await fixture();
  const { decodeUsageBatches } = await import("./index.ts");
  const { writeFile } = await import("node:fs/promises");
  await mkdir(join(root, "ai-tracking"));
  await writeFile(join(root, "ai-tracking/ai-code-tracking.db"), "");
  const db = new DatabaseSync(join(root, "acp-sessions/session-a/store.db"));
  try {
    db.exec(
      "PRAGMA journal_mode=WAL; INSERT INTO blobs VALUES ('0000000000000000000000000000000000000000000000000000000000000064',X'2001')",
    );
    const batches = [];
    for await (const batch of decodeUsageBatches([{ provider: "cursor", path: root }]))
      batches.push(batch);
    expect(batches).toHaveLength(1);
    expect(batches[0]!.sources[0]!.files.map((f) => f.path)).toEqual([
      join(root, "acp-sessions/session-a/store.db"),
      join(root, "acp-sessions/session-a/store.db-wal"),
    ]);
    const skipped = [];
    for await (const batch of decodeUsageBatches([{ provider: "cursor", path: root }], {
      skip: () => true,
    }))
      skipped.push(batch);
    expect(skipped).toEqual([]);
  } finally {
    db.close();
  }
});
test("a mixed-width state reference is not an anchor for an incomplete call", async () => {
  const root = await fixture(
    insert(50, { role: "assistant", content: [] }) +
      insert(51, Buffer.concat([state([50], 1767225607000), field(1, Buffer.from("short"))])),
  );
  expect((await records(root)).filter((r) => r.type === "call")).toHaveLength(4);
  expect(await records(root)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: "source-error", code: "malformed-record" }),
    ]),
  );
});
test("wire varints beyond 64 bits are malformed", async () => {
  const root = await fixture(insert(50, Buffer.from([32, ...Array(9).fill(255), 3])));
  expect((await records(root)).filter((r) => r.type === "source-error")).toEqual([
    expect.objectContaining({ code: "malformed-record" }),
  ]);
});
