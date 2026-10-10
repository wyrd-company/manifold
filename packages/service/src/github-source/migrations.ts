// ---
// relationships:
//   implements: github-source-database-schema
// ---
export const githubSteps: readonly string[] = [
  `-- ---
-- relationships:
--   realizes: github-source-database-schema
-- ---
-- SQLite schema of the tables the GitHub event source owns in Manifold's
-- database file, beside the store's and the router's tables and migrated
-- under the owner \`github\`.

CREATE TABLE github_delivery (
  delivery_id TEXT PRIMARY KEY CHECK (delivery_id <> ''),
  hook_id INTEGER NOT NULL CHECK (hook_id > 0),
  event TEXT NOT NULL,
  received_at INTEGER NOT NULL
) STRICT, WITHOUT ROWID;

CREATE TABLE github_redelivery (
  delivery_id TEXT PRIMARY KEY CHECK (delivery_id <> ''),
  hook_id INTEGER NOT NULL CHECK (hook_id > 0),
  attempt_id INTEGER NOT NULL,
  requested_at INTEGER NOT NULL
) STRICT, WITHOUT ROWID;

CREATE TABLE github_hook_scan (
  hook_id INTEGER PRIMARY KEY CHECK (hook_id > 0),
  scanned_through INTEGER NOT NULL
) STRICT;

CREATE TABLE github_pending (
  kind TEXT NOT NULL CHECK (kind IN ('issue', 'item', 'project')),
  node_id TEXT NOT NULL CHECK (node_id <> ''),
  requested_at INTEGER NOT NULL,
  generation INTEGER NOT NULL CHECK (generation > 0),
  project_node_id TEXT,
  PRIMARY KEY (kind, node_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE github_project (
  project_node_id TEXT PRIMARY KEY CHECK (project_node_id <> ''),
  owner TEXT NOT NULL CHECK (owner <> ''),
  number INTEGER NOT NULL CHECK (number > 0),
  closed INTEGER NOT NULL CHECK (closed IN (0, 1)),
  revision INTEGER NOT NULL CHECK (revision >= 0),
  fields_read_at INTEGER
) STRICT, WITHOUT ROWID;

CREATE TABLE github_item (
  item_node_id TEXT PRIMARY KEY CHECK (item_node_id <> ''),
  project_node_id TEXT NOT NULL,
  content_type TEXT NOT NULL
    CHECK (content_type IN ('issue', 'pull-request', 'draft-issue')),
  content_node_id TEXT NOT NULL,
  present INTEGER NOT NULL CHECK (present IN (0, 1)),
  archived INTEGER NOT NULL CHECK (archived IN (0, 1)),
  revision INTEGER NOT NULL CHECK (revision >= 0)
) STRICT, WITHOUT ROWID;

CREATE TABLE github_field_value (
  item_node_id TEXT NOT NULL,
  field_node_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  value TEXT CHECK (value IS NULL OR json_valid(value)),
  revision INTEGER NOT NULL CHECK (revision >= 0),
  PRIMARY KEY (item_node_id, field_node_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE github_issue (
  issue_node_id TEXT PRIMARY KEY CHECK (issue_node_id <> ''),
  repository TEXT NOT NULL CHECK (instr(repository, '/') > 1),
  number INTEGER NOT NULL CHECK (number > 0),
  state TEXT NOT NULL CHECK (state IN ('open', 'closed')),
  state_reason TEXT
    CHECK (state_reason IN ('completed', 'not_planned', 'duplicate', 'reopened')),
  baselined INTEGER NOT NULL CHECK (baselined IN (0, 1)),
  revision INTEGER NOT NULL CHECK (revision >= 0),
  content_revision INTEGER NOT NULL DEFAULT 0 CHECK (content_revision >= 0),
  present INTEGER NOT NULL DEFAULT 1 CHECK (present IN (0, 1)),
  body TEXT,
  last_edited_at INTEGER,
  milestone TEXT CHECK(milestone IS NULL OR json_valid(milestone)),
  issue_type TEXT CHECK(issue_type IS NULL OR json_valid(issue_type)),
  title TEXT,
  url TEXT
) STRICT, WITHOUT ROWID;

CREATE TABLE github_dependency (
  blocked_node_id TEXT NOT NULL,
  blocking_node_id TEXT NOT NULL,
  present INTEGER NOT NULL CHECK (present IN (0, 1)),
  revision INTEGER NOT NULL CHECK (revision >= 0),
  PRIMARY KEY (blocked_node_id, blocking_node_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE github_sub_issue (
  parent_node_id TEXT NOT NULL,
  sub_issue_node_id TEXT NOT NULL,
  present INTEGER NOT NULL CHECK (present IN (0, 1)),
  revision INTEGER NOT NULL CHECK (revision >= 0),
  PRIMARY KEY (parent_node_id, sub_issue_node_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE github_project_field (
  project_node_id TEXT NOT NULL CHECK (project_node_id <> ''),
  field_node_id TEXT NOT NULL CHECK (field_node_id <> ''),
  position INTEGER NOT NULL CHECK (position >= 0),
  name TEXT NOT NULL CHECK (name <> ''),
  data_type TEXT NOT NULL
    CHECK (data_type IN ('text', 'number', 'date', 'single-select', 'multi-select', 'iteration')),
  options TEXT NOT NULL CHECK (json_valid(options)),
  PRIMARY KEY (project_node_id, field_node_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE github_card_move (
  actor_id TEXT NOT NULL CHECK (actor_id <> ''),
  invoke_id TEXT NOT NULL CHECK (invoke_id <> ''),
  entry_id TEXT NOT NULL CHECK (entry_id <> ''),
  item_node_id TEXT NOT NULL CHECK (item_node_id <> ''),
  field_node_id TEXT NOT NULL CHECK (field_node_id <> ''),
  option_id TEXT NOT NULL CHECK (option_id <> ''),
  state TEXT NOT NULL CHECK (state IN ('sent', 'confirmed', 'doubtful')),
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  PRIMARY KEY (actor_id, invoke_id, entry_id, field_node_id, option_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX github_delivery_received ON github_delivery (received_at);

CREATE INDEX github_redelivery_requested ON github_redelivery (requested_at);

CREATE INDEX github_pending_requested ON github_pending (requested_at);

CREATE UNIQUE INDEX github_project_owner_number
  ON github_project (owner COLLATE NOCASE, number);

CREATE INDEX github_item_project ON github_item (project_node_id);

CREATE INDEX github_item_content ON github_item (content_node_id);

CREATE INDEX github_dependency_blocking ON github_dependency (blocking_node_id);

CREATE INDEX github_sub_issue_sub ON github_sub_issue (sub_issue_node_id);

CREATE INDEX github_card_move_field ON github_card_move (item_node_id, field_node_id, sequence);

-- The ordered issue content read with each tracked issue.
CREATE TABLE github_issue_label (
 issue_node_id TEXT NOT NULL, position INTEGER NOT NULL, label_node_id TEXT NOT NULL, name TEXT NOT NULL,
 PRIMARY KEY(issue_node_id,label_node_id)
) STRICT, WITHOUT ROWID;
CREATE TABLE github_issue_field_value (
 issue_node_id TEXT NOT NULL, position INTEGER NOT NULL, field_node_id TEXT NOT NULL, name TEXT NOT NULL,
 value TEXT NOT NULL CHECK(json_valid(value)), PRIMARY KEY(issue_node_id,field_node_id)
) STRICT, WITHOUT ROWID;
-- A shared scope's last observation, and its ordered entities. Kind-specific
-- tables exist before adapters open, under this module's sole schema step.
CREATE TABLE github_scope (
 scope_key TEXT PRIMARY KEY, scope TEXT NOT NULL CHECK(json_valid(scope)), status TEXT NOT NULL,
 read_at INTEGER NOT NULL, message TEXT
) STRICT, WITHOUT ROWID;
CREATE TABLE github_issue_field (
 scope_key TEXT NOT NULL, node_id TEXT NOT NULL, position INTEGER NOT NULL, name TEXT NOT NULL,
 data_type TEXT NOT NULL, options TEXT NOT NULL CHECK(json_valid(options)), PRIMARY KEY(scope_key,node_id)
) STRICT, WITHOUT ROWID;
CREATE TABLE github_issue_type (
 scope_key TEXT NOT NULL, node_id TEXT NOT NULL, position INTEGER NOT NULL, name TEXT NOT NULL,
 color TEXT, description TEXT NOT NULL, enabled INTEGER NOT NULL CHECK(enabled IN(0,1)), PRIMARY KEY(scope_key,node_id)
) STRICT, WITHOUT ROWID;
CREATE TABLE github_label (
 scope_key TEXT NOT NULL, node_id TEXT NOT NULL, position INTEGER NOT NULL, name TEXT NOT NULL,
 color TEXT NOT NULL, description TEXT NOT NULL, PRIMARY KEY(scope_key,node_id)
) STRICT, WITHOUT ROWID;
CREATE TABLE github_milestone (
 scope_key TEXT NOT NULL, node_id TEXT NOT NULL, position INTEGER NOT NULL, number INTEGER NOT NULL,
 title TEXT NOT NULL, description TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN('open','closed')), PRIMARY KEY(scope_key,node_id)
) STRICT, WITHOUT ROWID;
-- Invocation identity is stable across restart. A pending body check always
-- runs before an equal-value shortcut; attempt 2 can never repair again.
CREATE TABLE github_task_field_write (
 actor_id TEXT NOT NULL, invoke_id TEXT NOT NULL, entry_id TEXT NOT NULL,
 issue_node_id TEXT NOT NULL, project_node_id TEXT NOT NULL, field TEXT NOT NULL,
 storage TEXT NOT NULL CHECK(json_valid(storage)), value TEXT NOT NULL CHECK(json_valid(value)),
 status TEXT NOT NULL CHECK(status IN('sent','confirmed','refused')),
 attributed INTEGER NOT NULL DEFAULT 0 CHECK(attributed IN(0,1)),
 attempt INTEGER NOT NULL DEFAULT 0 CHECK(attempt BETWEEN 0 AND 2),
 basis_edited_at INTEGER, basis_body TEXT, original_edited_at INTEGER, repair_body TEXT,
 check_state TEXT NOT NULL DEFAULT 'none' CHECK(check_state IN('none','pending','passed','conflict')),
 conflict_edited_at INTEGER, written_at INTEGER NOT NULL,
 sequence INTEGER NOT NULL UNIQUE,
 PRIMARY KEY(actor_id,invoke_id,entry_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX github_task_field_write_target ON github_task_field_write(issue_node_id,project_node_id,field,written_at);

`,
];
