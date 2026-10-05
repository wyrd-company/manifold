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
  CHECK ((status = 'sent') = (sequence IS NOT NULL)),
  CHECK ((status = 'failed') = (error IS NOT NULL)),
  CHECK ((status = 'pending') = (settled_at IS NULL))
) STRICT;

CREATE INDEX agenttool_answer_pending ON agenttool_answer (written_at)
  WHERE status = 'pending';
