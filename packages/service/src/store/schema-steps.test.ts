// ---
// relationships:
//   verifies: store-database-schema
// ---
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vite-plus/test";
import { childProcessLimit } from "../../../../test-support/limits.ts";
import { openStore } from "./index.ts";
import predecessorFixture from "./test-fixtures/pre-fold-schemas.json" with { type: "json" };

import { storeSteps as owner0Steps } from "../store/migrations.ts";
import { agentToolSteps as owner1Steps } from "../agent-tools/migrations.ts";
import { bundleMigrationSteps as owner2Steps } from "../bundle/migrations.ts";
import { migrations as owner3Steps } from "../environments/migrations.ts";
import { escalationSteps as owner4Steps } from "../escalations/migrations.ts";
import { gatesMigrationSteps as owner5Steps } from "../gates/migrations.ts";
import { githubSteps as owner6Steps } from "../github-source/migrations.ts";
import { historySteps as owner7Steps } from "../history/migrations.ts";
import { intakeMigrationSteps as owner8Steps } from "../intake/migrations.ts";
import { ledgerMigrationSteps as owner9Steps } from "../ledger/migrations.ts";
import { portfolioMigrationSteps as owner10Steps } from "../portfolio/migrations.ts";
import { routerSteps as owner11Steps } from "../router/migrations.ts";
import { migrations as owner12Steps } from "../t3code-source/migrations.ts";
import { taskMetadataMigrationSteps as owner13Steps } from "../task-metadata/migrations.ts";
import { usageMigrationSteps as owner14Steps } from "../usage/migrations.ts";
const predecessors = predecessorFixture.owners;
const currentSteps = [
  owner0Steps,
  owner1Steps,
  owner2Steps,
  owner3Steps,
  owner4Steps,
  owner5Steps,
  owner6Steps,
  owner7Steps,
  owner8Steps,
  owner9Steps,
  owner10Steps,
  owner11Steps,
  owner12Steps,
  owner13Steps,
  owner14Steps,
];

const schema = (db: DatabaseSync) =>
  db
    .prepare("SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY name")
    .all()
    .map((row) => ({
      ...row,
      sql:
        typeof row["sql"] === "string"
          ? row["sql"]
              .replace(/"([a-z_]+)"/g, "$1")
              .replace(/\s+/g, " ")
              .replace(/\s*,\s*/g, ",")
              .replace(/\s*\)\s*/g, ")")
              .trim()
          : row["sql"],
    }));

const expectedSteps = (owner: string, steps: string[]) => {
  const specification = (
    {
      store: "store-database-schema",
      router: "router-database-schema",
      gates: "gates-database-schema",
      history: "history-database-schema",
      github: "github-source-database-schema",
      metadata: "task-metadata-tables",
      usage: "usage-tables",
      tthree: "t3code-source-database-schema",
    } as Record<string, string>
  )[owner];
  return specification
    ? [
        readFileSync(
          new URL(`../../../../docs/specifications/${specification}.sql`, import.meta.url),
          "utf8",
        ),
      ]
    : steps;
};

for (const [index, { owner, steps }] of predecessors.entries()) {
  test(`${owner} creates its declared schema in one step`, () => {
    const current = currentSteps[index]!;
    expect(current).toHaveLength(1);
    const old = new DatabaseSync(":memory:");
    const fresh = new DatabaseSync(":memory:");
    try {
      for (const step of expectedSteps(owner, steps)) old.exec(step);
      for (const step of current) fresh.exec(step);
      if (owner === "store") old.exec("DROP TABLE schema_migration");
      expect(schema(fresh)).toEqual(schema(old));
    } finally {
      old.close();
      fresh.close();
    }
  });
}

test(
  "an older build's populated store is rejected without changing the file",
  () => {
    const directory = mkdtempSync(join(tmpdir(), "schema-steps-"));
    const path = join(directory, "store.sqlite");
    try {
      const db = new DatabaseSync(path);
      db.exec(
        "CREATE TABLE schema_migration (owner TEXT PRIMARY KEY, version INTEGER NOT NULL) STRICT;",
      );
      for (const { owner, steps } of predecessors) {
        for (const step of steps) db.exec(step);
        db.prepare("INSERT INTO schema_migration VALUES (?, ?)").run(owner, steps.length);
      }
      db.exec(
        `INSERT INTO store_snapshot VALUES ('parcel', 'delivery', 'active', '{"value":"waiting","context":{}}', 10);`,
      );
      db.close();
      const before = readFileSync(path);
      expect(() => openStore({ path })).toThrow(/store.*create a new store/i);
      expect(readFileSync(path)).toEqual(before);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
  childProcessLimit,
);

test("fresh public migrations run once and reopen with one version per owner", () => {
  const directory = mkdtempSync(join(tmpdir(), "schema-steps-"));
  const path = join(directory, "store.sqlite");
  let store = openStore({ path });
  const reference = new DatabaseSync(":memory:");
  try {
    reference.exec(
      readFileSync(
        new URL("../../../../docs/specifications/store-database-schema.sql", import.meta.url),
        "utf8",
      ),
    );
    for (const [index, { owner, steps }] of predecessors.entries()) {
      if (owner !== "store") for (const step of expectedSteps(owner, steps)) reference.exec(step);
      store.connection.migrate(owner, currentSteps[index]!);
      store.connection.migrate(owner, currentSteps[index]!);
    }
    expect(schema(store.connection.database)).toEqual(schema(reference));
    store.saveSnapshot({
      actorId: "parcel",
      machine: "delivery",
      snapshot: { status: "active", value: "waiting", context: {} },
    });
    store.close();
    store = openStore({ path });
    for (const [index, { owner }] of predecessors.entries())
      store.connection.migrate(owner, currentSteps[index]!);
    expect(store.loadSnapshot("parcel")?.snapshot["value"]).toBe("waiting");
    expect(
      store.connection.database
        .prepare("SELECT owner, version FROM schema_migration ORDER BY owner")
        .all(),
    ).toEqual(
      predecessors
        .map(({ owner }) => ({ owner, version: 1 }))
        .sort((a, b) => a.owner.localeCompare(b.owner)),
    );
  } finally {
    store.close();
    reference.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const [index, { owner, steps }] of predecessors.entries()) {
  if (owner === "store" || steps.length === 1) continue;
  test(`${owner} rejects its populated predecessor through the public migration interface`, () => {
    const store = openStore({ path: ":memory:" });
    try {
      const db = store.connection.database;
      for (const step of steps) db.exec(step);
      db.prepare("INSERT INTO schema_migration VALUES (?, ?)").run(owner, steps.length);
      store.saveSnapshot({
        actorId: "parcel",
        machine: "delivery",
        snapshot: { status: "active", value: "waiting", context: {} },
      });
      const before = schema(db);
      const versions = db.prepare("SELECT * FROM schema_migration ORDER BY owner").all();
      const snapshot = store.loadSnapshot("parcel");
      expect(() => store.connection.migrate(owner, currentSteps[index]!)).toThrow(
        new RegExp(`${owner}.*create a new store`, "i"),
      );
      expect(schema(db)).toEqual(before);
      expect(db.prepare("SELECT * FROM schema_migration ORDER BY owner").all()).toEqual(versions);
      expect(store.loadSnapshot("parcel")).toEqual(snapshot);
    } finally {
      store.close();
    }
  });
}

test("a populated predecessor at store version 1 is refused despite the reused version number", () => {
  const directory = mkdtempSync(join(tmpdir(), "schema-steps-"));
  const path = join(directory, "store.sqlite");
  try {
    const db = new DatabaseSync(path);
    db.exec(
      "CREATE TABLE schema_migration (owner TEXT PRIMARY KEY, version INTEGER NOT NULL) STRICT;",
    );
    db.exec(predecessors.find(({ owner }) => owner === "store")!.steps[0]!);
    db.exec(
      `INSERT INTO schema_migration VALUES ('store', 1); INSERT INTO store_snapshot VALUES ('parcel', 'delivery', 'active', '{"value":"waiting","context":{}}', 10);`,
    );
    db.close();
    const before = readFileSync(path);
    expect(() => openStore({ path })).toThrow(/store.*create a new store/i);
    expect(readFileSync(path)).toEqual(before);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
