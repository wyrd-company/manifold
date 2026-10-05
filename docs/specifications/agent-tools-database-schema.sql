-- ---
-- relationships:
--   realizes: agent-tools-database-schema
-- ---
-- SQLite schema of the tables the agent tools module owns in Manifold's
-- database file, beside the store's, the router's, and the escalations
-- module's tables, and migrated under the owner `agenttool`.

CREATE TABLE agenttool_question (
  environment TEXT NOT NULL CHECK (length(environment) > 0),
  environment_id TEXT NOT NULL CHECK (length(environment_id) > 0),
  thread_id TEXT NOT NULL CHECK (length(thread_id) > 0),
  turn_id TEXT NOT NULL CHECK (length(turn_id) > 0),
  escalation_id TEXT NOT NULL UNIQUE CHECK (length(escalation_id) = 22),
  actor_id TEXT NOT NULL CHECK (length(actor_id) > 0),
  raised_at INTEGER NOT NULL,
  PRIMARY KEY (environment, environment_id, thread_id, turn_id)
) STRICT;

CREATE INDEX agenttool_question_actor ON agenttool_question (actor_id);

CREATE TABLE agenttool_answer (
  escalation_id TEXT PRIMARY KEY CHECK (length(escalation_id) = 22),
  environment TEXT NOT NULL CHECK (length(environment) > 0),
  thread_id TEXT NOT NULL CHECK (length(thread_id) > 0),
  message_id TEXT NOT NULL UNIQUE CHECK (length(message_id) = 36),
  text TEXT NOT NULL CHECK (length(text) > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  sequence INTEGER,
  error TEXT,
  written_at INTEGER NOT NULL,
  settled_at INTEGER,
  turn_id TEXT CHECK (turn_id IS NULL OR length(turn_id) > 0),
  placed_at INTEGER,
  CHECK ((status = 'sent') = (sequence IS NOT NULL)),
  CHECK ((status = 'failed') = (error IS NOT NULL)),
  CHECK ((status = 'pending') = (settled_at IS NULL)),
  CHECK (turn_id IS NULL OR placed_at IS NOT NULL)
) STRICT;

CREATE INDEX agenttool_answer_pending ON agenttool_answer (written_at)
  WHERE status = 'pending';

CREATE TABLE agenttool_message (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL UNIQUE CHECK (length(message_id) = 36),
  environment TEXT NOT NULL CHECK (length(environment) > 0),
  thread_id TEXT NOT NULL CHECK (length(thread_id) > 0),
  sender_actor_id TEXT NOT NULL CHECK (length(sender_actor_id) > 0),
  sender_issue TEXT CHECK (sender_issue IS NULL OR length(sender_issue) > 0),
  text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 8000),
  sent_at INTEGER NOT NULL,
  delivered_at INTEGER,
  delivered_to TEXT CHECK (delivered_to IS NULL OR length(delivered_to) > 0),
  noticed_at INTEGER,
  read_at INTEGER,
  read_turn_id TEXT CHECK (read_turn_id IS NULL OR length(read_turn_id) > 0),
  read_position INTEGER CHECK (read_position IS NULL OR read_position > 0),
  CHECK ((delivered_at IS NULL) = (delivered_to IS NULL)),
  CHECK (noticed_at IS NULL OR delivered_at IS NOT NULL),
  CHECK (read_at IS NULL OR delivered_at IS NOT NULL),
  CHECK ((read_at IS NULL) = (read_turn_id IS NULL)),
  CHECK ((read_at IS NULL) = (read_position IS NULL))
) STRICT;

CREATE INDEX agenttool_message_thread ON agenttool_message (environment, thread_id, sequence);

CREATE UNIQUE INDEX agenttool_message_read ON agenttool_message (environment, thread_id, read_position)
  WHERE read_position IS NOT NULL;

CREATE INDEX agenttool_message_unnoticed ON agenttool_message (environment, thread_id)
  WHERE delivered_at IS NOT NULL AND read_at IS NULL AND noticed_at IS NULL;
