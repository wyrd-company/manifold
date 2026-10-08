-- ---
-- relationships:
--   asset-of: history-database-schema
-- ---
-- The history module's tables: the schema that its migration steps
-- produce. The store applies the steps with `migrate("history", steps)`
-- and records the version in `schema_migration`; the module runs no DDL.

-- State visits: one row per run of an actor's saves with one state value
-- and one blueprint version. `machine` is the key the saves were made
-- with. `exit_event_type` and `exit_event_id` name the event the save
-- that left the visit took; both are null for a visit left by a save
-- that took no event and for a visit closed by the actor's end.
CREATE TABLE history_visit (
  actor_id TEXT NOT NULL CHECK (length(actor_id) > 0),
  visit INTEGER NOT NULL CHECK (visit >= 1),
  machine TEXT NOT NULL CHECK (length(machine) > 0),
  state_value TEXT NOT NULL CHECK (json_valid(state_value)),
  entered_at INTEGER NOT NULL,
  exited_at INTEGER CHECK (exited_at >= entered_at),
  exit_event_type TEXT CHECK (length(exit_event_type) > 0),
  exit_event_id TEXT CHECK (length(exit_event_id) > 0),
  PRIMARY KEY (actor_id, visit),
  CHECK (exit_event_type IS NULL OR exited_at IS NOT NULL),
  CHECK (exit_event_id IS NULL OR exit_event_type IS NOT NULL)
) STRICT, WITHOUT ROWID;

-- The visit in which an actor took each inbox event it consumed. The
-- event's topic, payload, and times stay on the store's inbox row of the
-- same actor and event id. `visit` is null for an event taken before the
-- actor's first recorded visit.
CREATE TABLE history_event (
  actor_id TEXT NOT NULL CHECK (length(actor_id) > 0),
  event_id TEXT NOT NULL CHECK (length(event_id) > 0),
  visit INTEGER,
  PRIMARY KEY (actor_id, event_id),
  FOREIGN KEY (actor_id, visit) REFERENCES history_visit (actor_id, visit)
) STRICT, WITHOUT ROWID;

-- Each T3 Code command an actor's invoke sent, recorded before it was
-- sent, as the agent threads module reported it. `kind` is the
-- implementation that sent it. `message_id` is the user message id of a
-- `turn-start`. `sequence` and `accepted_at` are null until the server's
-- answer is recorded, and stay null for a command whose answer never
-- arrived.
CREATE TABLE history_command (
  command_id TEXT PRIMARY KEY CHECK (length(command_id) > 0),
  actor_id TEXT NOT NULL CHECK (length(actor_id) > 0),
  kind TEXT NOT NULL CHECK (length(kind) > 0),
  invoke_id TEXT NOT NULL CHECK (length(invoke_id) > 0),
  entry_id TEXT NOT NULL CHECK (length(entry_id) > 0),
  environment TEXT NOT NULL CHECK (length(environment) > 0),
  thread_id TEXT NOT NULL CHECK (length(thread_id) > 0),
  message_id TEXT CHECK (length(message_id) > 0),
  sent_at INTEGER NOT NULL,
  sequence INTEGER CHECK (sequence >= 0),
  accepted_at INTEGER,
  CHECK ((sequence IS NULL) = (accepted_at IS NULL))
) STRICT;

CREATE INDEX history_command_by_actor ON history_command (actor_id, sent_at, command_id);
