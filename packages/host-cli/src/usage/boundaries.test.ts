// ---
// relationships:
//   verifies: usage-decoder
// ---
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { expect, test, vi } from "vite-plus/test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parse as parseYaml } from "yaml";
import { decodeUsage } from "./index.ts";

// Inject storage faults at the system boundary; adapters stay private.
const fault = vi.hoisted(() => ({ path: "", reads: 0, directory: "" }));
vi.mock("node:fs/promises", async (original) => {
  const fs = await original<typeof import("node:fs/promises")>();
  return {
    ...fs,
    readdir: (...args: Parameters<typeof fs.readdir>) => {
      if (args[0] === fault.directory)
        throw Object.assign(new Error("Directory unreadable"), { code: "EACCES" });
      return fs.readdir(...args);
    },
    readFile: (...args: Parameters<typeof fs.readFile>) => {
      if (args[0] === fault.path && ++fault.reads > 1)
        throw new Error("Source vanished after its first read");
      return fs.readFile(...args);
    },
  };
});
vi.mock("node:sqlite", async (original) => {
  const sqlite = await original<typeof import("node:sqlite")>();
  return {
    ...sqlite,
    DatabaseSync: class extends sqlite.DatabaseSync {
      constructor(...args: ConstructorParameters<typeof sqlite.DatabaseSync>) {
        if (args[1]?.readOnly !== true) throw new Error("Storage rejects writable handles");
        super(...args);
      }
    },
  };
});
const fixtures = fileURLToPath(new URL("./fixtures/", import.meta.url));
const validator = new Ajv2020({ strict: true }).compile(
  parseYaml(
    await readFile(
      new URL("../../../../docs/specifications/usage-record.schema.yml", import.meta.url),
      "utf8",
    ),
  ),
);

test("reads a canonical source once even if another root reaches it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "usage-source-fault-"));
  try {
    await cp(join(fixtures, "claude"), directory, { recursive: true });
    fault.path = join(directory, "projects/example/session-a.jsonl");
    fault.reads = 0;
    const records = [];
    for await (const record of decodeUsage([
      { provider: "claude", path: directory },
      { provider: "claude", path: join(directory, "projects", "..") },
    ])) {
      expect(validator(record), JSON.stringify(validator.errors)).toBe(true);
      records.push(record);
    }
    expect(records.filter((record) => record.type === "call")).toHaveLength(3);
    expect(
      records.some((record) => record.type === "source-error" && record.code === "unreadable"),
    ).toBe(false);
  } finally {
    fault.path = "";
    await rm(directory, { recursive: true, force: true });
  }
});

test("decodes SQLite sources when storage rejects writable handles", async () => {
  const directory = await mkdtemp(join(tmpdir(), "usage-sqlite-fault-"));
  const sqlite = await vi.importActual<typeof import("node:sqlite")>("node:sqlite");
  const db = new sqlite.DatabaseSync(join(directory, "opencode.db"));
  try {
    db.exec(await readFile(join(fixtures, "opencode/sessions.sql"), "utf8"));
  } finally {
    db.close();
  }
  try {
    const records = [];
    for await (const record of decodeUsage([{ provider: "opencode", path: directory }])) {
      expect(validator(record), JSON.stringify(validator.errors)).toBe(true);
      records.push(record);
    }
    expect(
      records.map((record) => (record.type === "call" ? record.unit.id : record.code)),
    ).toEqual(["child-db", "total-db"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("an unreadable directory preserves readable sibling sources", async () => {
  const root = await mkdtemp(join(tmpdir(), "usage-directory-fault-"));
  try {
    await cp(join(fixtures, "claude"), root, { recursive: true });
    fault.directory = join(root, "projects/blocked");
    await mkdir(fault.directory);
    const records = [];
    for await (const record of decodeUsage([
      { provider: "claude", path: root },
      { provider: "claude", path: root },
    ])) {
      expect(validator(record), JSON.stringify(validator.errors)).toBe(true);
      records.push(record);
    }
    expect(records.filter((record) => record.type === "call")).toHaveLength(3);
    expect(
      records.filter((record) => record.type === "source-error" && record.code === "unreadable"),
    ).toEqual([
      {
        type: "source-error",
        provider: "claude",
        source: fault.directory,
        code: "unreadable",
        records: 1,
      },
    ]);
  } finally {
    fault.directory = "";
    await rm(root, { recursive: true, force: true });
  }
});
