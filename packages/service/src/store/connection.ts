// ---
// relationships:
//   implements: store
// ---
import { DatabaseSync } from "node:sqlite";
import type { StoreConnection } from "./types.ts";
import { storeSteps } from "./migrations.ts";

function assertSupportedVersion(owner: string, version: number, supported: number) {
  if (version > supported)
    throw new Error(
      `Schema owner ${owner} has version ${version}; this build supports ${supported}. Create a new store.`,
    );
}

export function openConnection(path: string): StoreConnection {
  const database = new DatabaseSync(path);
  let depth = 0;
  let nextSavepoint = 0;
  const connection: StoreConnection = {
    database,
    transaction(work) {
      const savepoint = depth === 0 ? undefined : `store_transaction_${nextSavepoint++}`;
      database.exec(savepoint ? `SAVEPOINT ${savepoint}` : "BEGIN IMMEDIATE");
      depth++;
      try {
        const result = work();
        if (
          result !== null &&
          (typeof result === "object" || typeof result === "function") &&
          "then" in result &&
          typeof result.then === "function"
        )
          throw new TypeError("Transactions must be synchronous");
        database.exec(savepoint ? `RELEASE ${savepoint}` : "COMMIT");
        return result;
      } catch (error) {
        database.exec(savepoint ? `ROLLBACK TO ${savepoint}` : "ROLLBACK");
        if (savepoint) database.exec(`RELEASE ${savepoint}`);
        throw error;
      } finally {
        depth--;
      }
    },
    migrate(owner, steps) {
      if (!/^[a-z]+$/.test(owner)) throw new TypeError("Migration owner must be a lower-case word");
      connection.transaction(() => {
        const version = Number(
          database.prepare("SELECT version FROM schema_migration WHERE owner = ?").get(owner)?.[
            "version"
          ] ?? 0,
        );
        assertSupportedVersion(owner, version, steps.length);
        for (const step of steps.slice(version)) database.exec(step);
        database
          .prepare(
            "INSERT INTO schema_migration (owner, version) VALUES (?, ?) ON CONFLICT (owner) DO UPDATE SET version = excluded.version",
          )
          .run(owner, steps.length);
      });
    },
  };
  try {
    if (database.prepare("SELECT name FROM sqlite_schema WHERE name = 'schema_migration'").get()) {
      const version = Number(
        database.prepare("SELECT version FROM schema_migration WHERE owner = 'store'").get()?.[
          "version"
        ] ?? 0,
      );
      assertSupportedVersion("store", version, storeSteps.length);
      if (
        version === 1 &&
        !database
          .prepare("SELECT name FROM sqlite_schema WHERE name = 'store_migration_failure'")
          .get()
      )
        throw new Error("Schema owner store has a pre-0.1.0 schema. Create a new store.");
    }
    database.exec(
      "PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON;",
    );
    connection.transaction(() =>
      database.exec(
        "CREATE TABLE IF NOT EXISTS schema_migration ( owner TEXT PRIMARY KEY CHECK (owner GLOB '[a-z]*' AND owner NOT GLOB '*[^a-z]*'), version INTEGER NOT NULL CHECK (version >= 0) ) STRICT;",
      ),
    );
    return connection;
  } catch (error) {
    database.close();
    throw error;
  }
}
