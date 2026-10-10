// ---
// relationships:
//   implements: history-database-schema
// ---
export const historySteps = [
  String.raw`

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

CREATE TABLE history_event (
  actor_id TEXT NOT NULL CHECK (actor_id <> ''),
  event_id TEXT NOT NULL CHECK (event_id <> ''),
  visit INTEGER,
  PRIMARY KEY (actor_id, event_id),
  FOREIGN KEY (actor_id, visit) REFERENCES history_visit (actor_id, visit)
) STRICT, WITHOUT ROWID;

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
`,
] as const;
