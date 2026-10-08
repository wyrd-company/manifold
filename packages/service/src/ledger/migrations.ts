// ---
// relationships:
//   implements: portfolio-ledger-tables
// ---
export const ledgerMigrationSteps: readonly string[] = [
  String.raw`-- ---
-- relationships:
--   asset-of: portfolio-ledger-tables
-- ---
-- The portfolio ledger's tables: the schema that the ledger's migration
-- steps produce. The store applies the steps with \`migrate("ledger", steps)\`
-- and records the version in \`schema_migration\`; the ledger runs no DDL.

-- One row per idempotent write: credit, reserve, actual, and move.
-- \`request\` is the canonical JSON of the request (keys sorted), so a replay
-- with the same key is compared to the first request field by field.
CREATE TABLE ledger_operations (
  key TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('credit', 'reserve', 'actual', 'move')),
  request TEXT NOT NULL,
  at INTEGER NOT NULL
) STRICT;

-- One row per account window. The first credit of a window writes it.
-- A window is current for its account from \`opens_at\` until a window with a
-- later \`opens_at\` exists. \`closes_at\` is the expected reset, used by pacing.
CREATE TABLE ledger_windows (
  account TEXT NOT NULL,
  window_key TEXT NOT NULL,
  opens_at INTEGER NOT NULL,
  closes_at INTEGER NOT NULL,
  PRIMARY KEY (account, window_key),
  UNIQUE (account, opens_at),
  CHECK (closes_at > opens_at)
) STRICT;

-- One row per settled actor. A settled actor reserves nothing more.
CREATE TABLE ledger_settlements (
  actor TEXT PRIMARY KEY,
  at INTEGER NOT NULL
) STRICT;

-- The ledger: signed entries, never updated and never deleted.
--   credit   adds capacity to an account window. No item, no actor.
--   actual   posts usage to an actor and item in the window of its use.
--   reserve  holds an estimate for an actor on an item. No window.
--   settle   retires an actor's net reservation on an item. No window.
--   move     carries an outstanding reservation from one item to another,
--            as a pair of rows with the same operation and opposite signs.
-- \`amount\` is an integer in the account's native unit.
CREATE TABLE ledger_entries (
  seq INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('credit', 'actual', 'reserve', 'settle', 'move')),
  operation TEXT,
  account TEXT NOT NULL,
  window_key TEXT,
  item TEXT,
  actor TEXT,
  amount INTEGER NOT NULL,
  at INTEGER NOT NULL,
  CHECK ((kind = 'settle') = (operation IS NULL)),
  CHECK ((kind IN ('credit', 'actual')) = (window_key IS NOT NULL)),
  CHECK ((kind = 'credit') = (item IS NULL)),
  CHECK ((kind = 'credit') = (actor IS NULL)),
  CHECK (kind <> 'credit' OR amount > 0),
  CHECK (kind <> 'actual' OR amount >= 0),
  CHECK (kind <> 'reserve' OR amount > 0),
  CHECK (kind <> 'settle' OR amount < 0),
  CHECK (kind <> 'move' OR amount <> 0)
) STRICT;

-- Window sums: credits and actuals of one account window.
CREATE INDEX ledger_entries_by_window
  ON ledger_entries (account, window_key, kind);

-- Outstanding reservations: entries of one actor on one item and account.
CREATE INDEX ledger_entries_by_actor
  ON ledger_entries (actor, account, item);

-- Append-only: every ledger table refuses UPDATE and DELETE.
CREATE TRIGGER ledger_operations_no_update
  BEFORE UPDATE ON ledger_operations
  BEGIN SELECT RAISE(ABORT, 'ledger_operations is append-only'); END;
CREATE TRIGGER ledger_operations_no_delete
  BEFORE DELETE ON ledger_operations
  BEGIN SELECT RAISE(ABORT, 'ledger_operations is append-only'); END;

CREATE TRIGGER ledger_windows_no_update
  BEFORE UPDATE ON ledger_windows
  BEGIN SELECT RAISE(ABORT, 'ledger_windows is append-only'); END;
CREATE TRIGGER ledger_windows_no_delete
  BEFORE DELETE ON ledger_windows
  BEGIN SELECT RAISE(ABORT, 'ledger_windows is append-only'); END;

CREATE TRIGGER ledger_settlements_no_update
  BEFORE UPDATE ON ledger_settlements
  BEGIN SELECT RAISE(ABORT, 'ledger_settlements is append-only'); END;
CREATE TRIGGER ledger_settlements_no_delete
  BEFORE DELETE ON ledger_settlements
  BEGIN SELECT RAISE(ABORT, 'ledger_settlements is append-only'); END;

CREATE TRIGGER ledger_entries_no_update
  BEFORE UPDATE ON ledger_entries
  BEGIN SELECT RAISE(ABORT, 'ledger_entries is append-only'); END;
CREATE TRIGGER ledger_entries_no_delete
  BEFORE DELETE ON ledger_entries
  BEGIN SELECT RAISE(ABORT, 'ledger_entries is append-only'); END;
`,
  "ALTER TABLE ledger_operations RENAME TO ledger_operations_step_one;\n\nCREATE TABLE ledger_operations (\n  key TEXT PRIMARY KEY,\n  kind TEXT NOT NULL CHECK (kind IN ('credit', 'reserve', 'actual', 'move', 'reattribute')),\n  request TEXT NOT NULL,\n  at INTEGER NOT NULL\n) STRICT;\n\nINSERT INTO ledger_operations SELECT * FROM ledger_operations_step_one;\n\nDROP TABLE ledger_operations_step_one;\n\nALTER TABLE ledger_entries RENAME TO ledger_entries_step_one;\n\nCREATE TABLE ledger_entries (\n  seq INTEGER PRIMARY KEY,\n  kind TEXT NOT NULL CHECK (\n    kind IN ('credit', 'actual', 'reserve', 'settle', 'move', 'reattribute')\n  ),\n  operation TEXT,\n  account TEXT NOT NULL,\n  window_key TEXT,\n  item TEXT,\n  actor TEXT,\n  amount INTEGER NOT NULL,\n  at INTEGER NOT NULL,\n  CHECK ((kind = 'settle') = (operation IS NULL)),\n  CHECK ((kind IN ('credit', 'actual', 'reattribute')) = (window_key IS NOT NULL)),\n  CHECK ((kind = 'credit') = (item IS NULL)),\n  CHECK ((kind = 'credit') = (actor IS NULL)),\n  CHECK (kind <> 'credit' OR amount > 0),\n  CHECK (kind <> 'actual' OR amount >= 0),\n  CHECK (kind <> 'reserve' OR amount > 0),\n  CHECK (kind <> 'settle' OR amount < 0),\n  CHECK (kind <> 'move' OR amount <> 0),\n  CHECK (kind <> 'reattribute' OR amount <> 0)\n) STRICT;\n\nINSERT INTO ledger_entries SELECT * FROM ledger_entries_step_one;\n\nDROP TABLE ledger_entries_step_one;\n\nCREATE INDEX ledger_entries_by_window\n  ON ledger_entries (account, window_key, kind);\n\n-- Outstanding reservations: entries of one actor on one item and account.\nCREATE INDEX ledger_entries_by_actor\n  ON ledger_entries (actor, account, item);\n\nCREATE TRIGGER ledger_operations_no_update\n  BEFORE UPDATE ON ledger_operations\n  BEGIN SELECT RAISE(ABORT, 'ledger_operations is append-only'); END;\n\nCREATE TRIGGER ledger_operations_no_delete\n  BEFORE DELETE ON ledger_operations\n  BEGIN SELECT RAISE(ABORT, 'ledger_operations is append-only'); END;\n\nCREATE TRIGGER ledger_entries_no_update\n  BEFORE UPDATE ON ledger_entries\n  BEGIN SELECT RAISE(ABORT, 'ledger_entries is append-only'); END;\n\nCREATE TRIGGER ledger_entries_no_delete\n  BEFORE DELETE ON ledger_entries\n  BEGIN SELECT RAISE(ABORT, 'ledger_entries is append-only'); END;",
];
