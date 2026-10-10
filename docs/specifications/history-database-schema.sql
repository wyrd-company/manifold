-- ---
-- relationships:
--   asset-of: history-database-schema
-- ---
-- The history module's tables: the schema that its migration steps
-- produce. The store applies the steps with `migrate("history", steps)`
-- and records the version in `schema_migration`; the module runs no DDL.

-- State visits: one row per run of an actor's saves with one state value
-- and one blueprint version. `machine` is the key the saves were made
-- with. `exit_event_type` and `exit_event_id` are the `changedBy` of the
-- save that left the visit: the event whose macrostep made the state
-- change, and the inbox event id of the routed event whose delivery made
-- it, null when none did. Both are null for a visit left by a save that
-- holds no state change and for a visit closed by the actor's end.
CREATE TABLE history_visit (
  actor_id TEXT NOT NULL CHECK (actor_id <> ''),
  visit INTEGER NOT NULL CHECK (visit >= 1),
  machine TEXT NOT NULL CHECK (machine <> ''),
  state_value TEXT NOT NULL CHECK (json_valid(state_value)),
  entered_at INTEGER NOT NULL,
  exited_at INTEGER CHECK (exited_at >= entered_at),
  exit_event_type TEXT CHECK (exit_event_type <> ''),
  exit_event_id TEXT CHECK (exit_event_id <> ''),
  PRIMARY KEY (actor_id, visit),
  CHECK (exit_event_type IS NULL OR exited_at IS NOT NULL),
  CHECK (exit_event_id IS NULL OR exit_event_type IS NOT NULL)
) STRICT, WITHOUT ROWID;

-- The visit in which an actor took each inbox event it consumed. The
-- event's topic, payload, and times stay on the store's inbox row of the
-- same actor and event id. `visit` is null for an event taken before the
-- actor's first recorded visit.
CREATE TABLE history_event (
  actor_id TEXT NOT NULL CHECK (actor_id <> ''),
  event_id TEXT NOT NULL CHECK (event_id <> ''),
  visit INTEGER,
  PRIMARY KEY (actor_id, event_id),
  FOREIGN KEY (actor_id, visit) REFERENCES history_visit (actor_id, visit)
) STRICT, WITHOUT ROWID;

-- Each T3 Code command an actor's invoke sent, recorded before it was
-- sent, as the agent threads module reported it. `kind` names what sent
-- it: `project-create` for `t3code-project-create`, else the
-- implementation. A `project-create` names the project it creates and no
-- thread; the other kinds name a thread and no project. `message_id` is
-- the user message id of a `turn-start`. `sequence` and `accepted_at`
-- are null until the server's answer is recorded, and stay null for a
-- command whose answer never arrived or that the server rejected.
CREATE TABLE history_command (
  command_id TEXT PRIMARY KEY CHECK (command_id <> ''),
  actor_id TEXT NOT NULL CHECK (actor_id <> ''),
  kind TEXT NOT NULL CHECK (kind IN ('project-create', 'thread-create', 'turn-start')),
  invoke_id TEXT NOT NULL CHECK (invoke_id <> ''),
  entry_id TEXT NOT NULL CHECK (entry_id <> ''),
  environment TEXT NOT NULL CHECK (environment <> ''),
  thread_id TEXT CHECK (thread_id <> ''),
  project_id TEXT CHECK (project_id <> ''),
  message_id TEXT CHECK (message_id <> ''),
  sent_at INTEGER NOT NULL,
  sequence INTEGER CHECK (sequence >= 0),
  accepted_at INTEGER,
  CHECK ((sequence IS NULL) = (accepted_at IS NULL)),
  CHECK ((kind = 'project-create') = (project_id IS NOT NULL)),
  CHECK ((kind = 'project-create') = (thread_id IS NULL))
) STRICT;

CREATE INDEX history_command_by_actor ON history_command (actor_id, sent_at, command_id);
