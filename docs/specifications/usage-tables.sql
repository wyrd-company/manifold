-- ---
-- relationships:
--   asset-of: usage-tables
-- ---
-- The usage intake module's tables: the schema that its migration steps
-- produce. The store applies the steps with `migrate("usage", steps)` and
-- records the version in `schema_migration`; the module runs no DDL.

-- One row per accepted declaration of `accounts.yml` and `prices.yml`
-- whose content differs from the declaration in force. The row with the
-- greatest `seq` is in force. `declaration` is canonical JSON, keys sorted.
CREATE TABLE usage_declarations (
  seq INTEGER PRIMARY KEY,
  commit_id TEXT NOT NULL CHECK (length(commit_id) > 0),
  declaration TEXT NOT NULL CHECK (json_valid(declaration)),
  accepted_at INTEGER NOT NULL
) STRICT;

CREATE TRIGGER usage_declarations_no_update
  BEFORE UPDATE ON usage_declarations
  BEGIN SELECT RAISE(ABORT, 'usage_declarations is append-only'); END;
CREATE TRIGGER usage_declarations_no_delete
  BEFORE DELETE ON usage_declarations
  BEGIN SELECT RAISE(ABORT, 'usage_declarations is append-only'); END;

-- The T3 Code thread that runs a provider session on an environment, as
-- the host first pushed it. A later push that names another thread for
-- the same session leaves this row.
CREATE TABLE usage_sessions (
  environment TEXT NOT NULL CHECK (length(environment) > 0),
  provider TEXT NOT NULL CHECK (length(provider) > 0),
  provider_session_id TEXT NOT NULL CHECK (length(provider_session_id) > 0),
  thread_id TEXT NOT NULL CHECK (length(thread_id) > 0),
  provider_instance TEXT,
  recorded_at INTEGER NOT NULL,
  PRIMARY KEY (environment, provider, provider_session_id)
) STRICT, WITHOUT ROWID;

-- The engine-owned identity of each actor the save hook has seen, as of
-- its latest save, and the time its first ending save was seen.
CREATE TABLE usage_actors (
  actor_id TEXT PRIMARY KEY CHECK (length(actor_id) > 0),
  environment TEXT,
  item TEXT,
  ended_at INTEGER
) STRICT;

-- The actor that owns a thread: the first actor whose save listed it.
CREATE TABLE usage_threads (
  environment TEXT NOT NULL CHECK (length(environment) > 0),
  thread_id TEXT NOT NULL CHECK (length(thread_id) > 0),
  actor_id TEXT NOT NULL CHECK (length(actor_id) > 0),
  PRIMARY KEY (environment, thread_id)
) STRICT, WITHOUT ROWID;

-- State visits: one row per run of an actor's saves with one state value.
CREATE TABLE usage_visits (
  actor_id TEXT NOT NULL CHECK (length(actor_id) > 0),
  visit INTEGER NOT NULL CHECK (visit >= 1),
  state_value TEXT NOT NULL CHECK (json_valid(state_value)),
  entered_at INTEGER NOT NULL,
  PRIMARY KEY (actor_id, visit)
) STRICT, WITHOUT ROWID;

CREATE INDEX usage_visits_by_time ON usage_visits (actor_id, entered_at);

-- The call record held for each call key of an environment: the first
-- record of a `call`, and the greatest copy of a `session-total`.
-- `revision` counts the postings made for the key.
CREATE TABLE usage_calls (
  environment TEXT NOT NULL CHECK (length(environment) > 0),
  call_key TEXT NOT NULL CHECK (length(call_key) > 0),
  record TEXT NOT NULL CHECK (json_valid(record)),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  received_at INTEGER NOT NULL,
  PRIMARY KEY (environment, call_key)
) STRICT, WITHOUT ROWID;

-- One posting per call record of a `call`, and one per growth of a
-- `session-total`, with the tokens it adds and the attribution fixed when
-- it was made. A pending posting waits for an account, a price, or a
-- ledger window; a posted one names its ledger operation.
CREATE TABLE usage_postings (
  seq INTEGER PRIMARY KEY,
  environment TEXT NOT NULL,
  call_key TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  used_at INTEGER NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  speed TEXT NOT NULL CHECK (speed IN ('standard', 'fast')),
  tokens TEXT NOT NULL CHECK (json_valid(tokens)),
  actor TEXT NOT NULL CHECK (length(actor) > 0),
  item TEXT NOT NULL CHECK (length(item) > 0),
  visit INTEGER,
  account TEXT,
  amount INTEGER CHECK (amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'posted')),
  reason TEXT CHECK (reason IN ('unaccounted', 'unpriced', 'no-window')),
  ledger_key TEXT UNIQUE,
  posted_at INTEGER,
  UNIQUE (environment, call_key, revision),
  FOREIGN KEY (environment, call_key) REFERENCES usage_calls (environment, call_key),
  CHECK ((status = 'pending') = (reason IS NOT NULL)),
  CHECK ((status = 'posted') = (ledger_key IS NOT NULL)),
  CHECK ((status = 'posted') = (posted_at IS NOT NULL)),
  CHECK (status = 'pending' OR (account IS NOT NULL AND amount IS NOT NULL)),
  CHECK (reason IS NOT 'unaccounted' OR account IS NULL)
) STRICT;

CREATE INDEX usage_postings_pending ON usage_postings (seq) WHERE status = 'pending';

CREATE INDEX usage_postings_by_actor ON usage_postings (actor, visit);

-- The latest source error record of each code for each source.
CREATE TABLE usage_source_errors (
  environment TEXT NOT NULL CHECK (length(environment) > 0),
  provider TEXT NOT NULL CHECK (length(provider) > 0),
  source TEXT NOT NULL CHECK (length(source) > 0),
  code TEXT NOT NULL CHECK (
    code IN ('unreadable', 'truncated', 'malformed-record', 'unknown-record', 'decoder-failed')
  ),
  records INTEGER NOT NULL CHECK (records >= 0),
  first_record INTEGER CHECK (first_record >= 0),
  detail TEXT,
  seen_at INTEGER NOT NULL,
  PRIMARY KEY (environment, provider, source, code)
) STRICT, WITHOUT ROWID;
