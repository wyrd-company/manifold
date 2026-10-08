-- ---
-- relationships:
--   realizes: gates-database-schema
-- ---
-- SQLite schema of the tables the gates module owns in Manifold's database
-- file, beside the store's tables and migrated under the owner `gates`.

-- One row per actor in a gated state: the entry the actor is in now.
-- `gate` is the gate key, `<blueprintPath>#<statePath>`.
-- `state_entry_id` is the actor host's id of the state entry; null until
-- the first save that gives it, for a row written at resume.
CREATE TABLE gates_entry (
  entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
  gate TEXT NOT NULL CHECK (length(gate) > 0),
  actor_id TEXT NOT NULL CHECK (length(actor_id) > 0),
  state_entry_id TEXT CHECK (state_entry_id IS NULL OR length(state_entry_id) > 0),
  entered_at INTEGER NOT NULL,
  UNIQUE (gate, actor_id)
) STRICT;

-- One row per gate key: the version that declares it in the newest
-- revision that does, and that revision's commit.
CREATE TABLE gates_declaration (
  gate TEXT PRIMARY KEY CHECK (length(gate) > 0),
  version TEXT NOT NULL CHECK (length(version) > 0),
  revision_commit TEXT NOT NULL CHECK (length(revision_commit) > 0),
  declared_at INTEGER NOT NULL
) STRICT, WITHOUT ROWID;

-- One row per comparator evaluation. `input` is the evaluation's input as
-- canonical JSON, without `random`; `version` is the blueprint version key
-- of the declaring version, whose comparator ran.
CREATE TABLE gates_evaluation (
  evaluation_id INTEGER PRIMARY KEY AUTOINCREMENT,
  gate TEXT NOT NULL CHECK (length(gate) > 0),
  version TEXT NOT NULL CHECK (length(version) > 0),
  evaluated_at INTEGER NOT NULL,
  seed INTEGER NOT NULL CHECK (seed BETWEEN 0 AND 4294967295),
  input TEXT NOT NULL CHECK (json_valid(input)),
  outcome TEXT NOT NULL CHECK (outcome IN ('selection', 'none', 'failure')),
  selection TEXT CHECK (selection IS NULL OR json_valid(selection)),
  failure_kind TEXT,
  failure_message TEXT,
  duration_ms REAL NOT NULL CHECK (duration_ms >= 0),
  CHECK ((outcome = 'selection') = (selection IS NOT NULL)),
  CHECK ((outcome = 'failure') = (failure_kind IS NOT NULL)),
  CHECK ((outcome = 'failure') = (failure_message IS NOT NULL))
) STRICT;

CREATE INDEX gates_evaluation_by_gate ON gates_evaluation (gate, evaluation_id);

-- Evaluations in the order they ran, read by retention.
CREATE INDEX gates_evaluation_by_time ON gates_evaluation (evaluated_at, evaluation_id);

-- One row per granted token. A token is held while `returned_at` is null,
-- whether its inbox row is consumed or pending. `evaluation_id` is null
-- once retention has deleted the evaluation of a returned token.
CREATE TABLE gates_token (
  token_id TEXT PRIMARY KEY CHECK (token_id = 'token:' || entry_id),
  gate TEXT NOT NULL CHECK (length(gate) > 0),
  actor_id TEXT NOT NULL CHECK (length(actor_id) > 0),
  entry_id INTEGER NOT NULL,
  state_entry_id TEXT CHECK (state_entry_id IS NULL OR length(state_entry_id) > 0),
  evaluation_id INTEGER REFERENCES gates_evaluation (evaluation_id) ON DELETE SET NULL,
  granted_at INTEGER NOT NULL,
  trapped INTEGER NOT NULL DEFAULT 0 CHECK (trapped IN (0, 1)),
  returned_at INTEGER,
  return_reason TEXT CHECK (return_reason IN ('return-point', 'ended', 'escalation')),
  return_state TEXT,
  CHECK ((returned_at IS NULL) = (return_reason IS NULL)),
  CHECK ((returned_at IS NULL) = (return_state IS NULL)),
  CHECK (evaluation_id IS NOT NULL OR returned_at IS NOT NULL)
) STRICT;

-- At most one held token per gate and actor.
CREATE UNIQUE INDEX gates_token_held ON gates_token (gate, actor_id) WHERE returned_at IS NULL;

-- Unreturned tokens of one actor, read by every save of that actor.
CREATE INDEX gates_token_by_actor ON gates_token (actor_id) WHERE returned_at IS NULL;

-- The token an evaluation granted, read when retention deletes the evaluation.
CREATE INDEX gates_token_by_evaluation ON gates_token (evaluation_id) WHERE evaluation_id IS NOT NULL;
