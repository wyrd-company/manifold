-- ---
-- relationships:
--   realizes: escalations-database-schema
-- ---
-- SQLite schema of the tables the escalations module owns in Manifold's
-- database file, beside the store's and the router's tables and migrated
-- under the owner `escalation`.

CREATE TABLE escalation (
  escalation_id TEXT PRIMARY KEY CHECK (length(escalation_id) = 22),
  actor_id TEXT,
  invoke_id TEXT,
  entry_id TEXT,
  kind TEXT CHECK (kind IN ('held-actor', 'stranded-token')),
  subject TEXT,
  occurrence INTEGER CHECK (occurrence > 0),
  title TEXT NOT NULL CHECK (length(title) > 0),
  question TEXT NOT NULL CHECK (length(question) > 0),
  choices TEXT NOT NULL,
  free_text INTEGER NOT NULL CHECK (free_text IN (0, 1)),
  destinations TEXT NOT NULL,
  key_digest BLOB NOT NULL CHECK (length(key_digest) = 32),
  status TEXT NOT NULL CHECK (status IN ('open', 'answered', 'withdrawn')),
  answer TEXT,
  channel TEXT CHECK (channel IN ('link', 'api')),
  raised_at INTEGER NOT NULL,
  closed_at INTEGER,
  taken_at INTEGER,
  handled_at INTEGER,
  CHECK (
    (actor_id IS NOT NULL AND invoke_id IS NOT NULL AND entry_id IS NOT NULL
      AND kind IS NULL AND subject IS NULL AND occurrence IS NULL
      AND handled_at IS NULL)
    OR
    (actor_id IS NULL AND invoke_id IS NULL AND entry_id IS NULL
      AND kind IS NOT NULL AND subject IS NOT NULL AND occurrence IS NOT NULL
      AND taken_at IS NULL)
  ),
  CHECK ((status = 'open') = (closed_at IS NULL)),
  CHECK ((status = 'answered') = (answer IS NOT NULL)),
  CHECK ((answer IS NULL) = (channel IS NULL)),
  CHECK ((taken_at IS NULL AND handled_at IS NULL) OR status = 'answered')
) STRICT, WITHOUT ROWID;

CREATE UNIQUE INDEX escalation_raiser
  ON escalation (actor_id, invoke_id, entry_id)
  WHERE actor_id IS NOT NULL;

CREATE UNIQUE INDEX escalation_occurrence
  ON escalation (kind, subject, occurrence)
  WHERE kind IS NOT NULL;

CREATE INDEX escalation_open_actor
  ON escalation (actor_id)
  WHERE status = 'open' AND actor_id IS NOT NULL;

CREATE INDEX escalation_status ON escalation (status, raised_at);

CREATE TABLE escalation_notification (
  notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
  escalation_id TEXT NOT NULL REFERENCES escalation (escalation_id),
  destination TEXT NOT NULL CHECK (length(destination) > 0),
  purpose TEXT NOT NULL CHECK (purpose IN ('ask', 'close')),
  message TEXT,
  status TEXT NOT NULL
    CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL CHECK (attempts >= 0),
  next_attempt_at INTEGER NOT NULL,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  settled_at INTEGER,
  CHECK ((status = 'pending') = (message IS NOT NULL)),
  CHECK ((status = 'pending') = (settled_at IS NULL)),
  UNIQUE (escalation_id, destination, purpose)
) STRICT;

CREATE INDEX escalation_notification_due
  ON escalation_notification (next_attempt_at)
  WHERE status = 'pending';
