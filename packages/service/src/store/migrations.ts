// ---
// relationships:
//   realizes: store-database-schema
// ---
export const storeSteps: readonly string[] = [
  `-- ---
-- relationships:
--   realizes: store-database-schema
-- ---
-- SQLite schema of the tables the store owns in Manifold's database file.
-- Tables owned by another module in the same file carry that module's prefix
-- and are defined by that module's specification.

CREATE TABLE store_snapshot (
  actor_id TEXT PRIMARY KEY CHECK (length(actor_id) > 0),
  machine TEXT NOT NULL CHECK (length(machine) > 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'done', 'stopped')),
  snapshot TEXT NOT NULL CHECK (json_valid(snapshot)),
  saved_at INTEGER NOT NULL,
  history_pruned_at INTEGER CHECK (history_pruned_at IS NULL OR status <> 'active')
) STRICT;

CREATE INDEX store_snapshot_prunable ON store_snapshot (saved_at, actor_id)
  WHERE status <> 'active' AND history_pruned_at IS NULL;

CREATE TABLE store_snapshot_state (
  actor_id TEXT NOT NULL REFERENCES store_snapshot (actor_id) ON DELETE CASCADE,
  machine TEXT NOT NULL,
  state_path TEXT NOT NULL CHECK (length(state_path) > 0),
  PRIMARY KEY (actor_id, state_path)
) STRICT, WITHOUT ROWID;

CREATE INDEX store_snapshot_state_by_path ON store_snapshot_state (machine, state_path, actor_id);

CREATE INDEX store_snapshot_state_by_state ON store_snapshot_state (state_path, actor_id);

CREATE TABLE store_errored_snapshot (
  actor_id TEXT PRIMARY KEY CHECK (length(actor_id) > 0),
  machine TEXT NOT NULL CHECK (length(machine) > 0),
  snapshot TEXT NOT NULL CHECK (json_valid(snapshot)),
  event_id TEXT,
  saved_at INTEGER NOT NULL
) STRICT;

CREATE TABLE store_inbox (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL CHECK (length(event_id) > 0),
  actor_id TEXT NOT NULL CHECK (length(actor_id) > 0),
  topic TEXT NOT NULL CHECK (length(topic) > 0),
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  received_at INTEGER NOT NULL,
  consumed_at INTEGER,
  UNIQUE (actor_id, event_id)
) STRICT;

CREATE INDEX store_inbox_pending ON store_inbox (actor_id, sequence) WHERE consumed_at IS NULL;

CREATE TABLE store_deadline (
  deadline_id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT NOT NULL CHECK (length(actor_id) > 0),
  state_path TEXT NOT NULL,
  event_name TEXT NOT NULL CHECK (length(event_name) > 0),
  fire_at INTEGER NOT NULL,
  entry_id TEXT NOT NULL CHECK (length(entry_id) > 0),
  fired_at INTEGER,
  UNIQUE (actor_id, state_path, event_name)
) STRICT;

CREATE INDEX store_deadline_due ON store_deadline (fire_at, actor_id) WHERE fired_at IS NULL;

CREATE TABLE store_migration_failure (
  actor_id TEXT PRIMARY KEY CHECK (length(actor_id) > 0),
  from_machine TEXT NOT NULL CHECK (length(from_machine) > 0),
  to_machine TEXT NOT NULL CHECK (length(to_machine) > 0),
  kind TEXT NOT NULL CHECK (kind IN ('version-invalid', 'restore-mismatch', 'gate-missing', 'token-return', 'token-trap', 'no-path', 'mapping-failed', 'mapping-timeout', 'context-rejected', 'store')),
  message TEXT NOT NULL,
  detail TEXT NOT NULL CHECK (json_valid(detail)),
  failed_at INTEGER NOT NULL
) STRICT;

CREATE INDEX store_migration_failure_by_target ON store_migration_failure (to_machine, actor_id);
`,
];
