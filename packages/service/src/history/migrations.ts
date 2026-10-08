// ---
// relationships:
//   implements: history-database-schema
// ---
export const historySteps = [
  String.raw`

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

CREATE TABLE history_event (
  actor_id TEXT NOT NULL CHECK (length(actor_id) > 0),
  event_id TEXT NOT NULL CHECK (length(event_id) > 0),
  visit INTEGER,
  PRIMARY KEY (actor_id, event_id),
  FOREIGN KEY (actor_id, visit) REFERENCES history_visit (actor_id, visit)
) STRICT, WITHOUT ROWID;

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
`,
] as const;
