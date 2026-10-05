// ---
// relationships:
//   implements: github-source-database-schema
// ---
export const githubSteps = [
  String.raw`-- ---
-- relationships:
--   realizes: github-source-database-schema
-- ---
-- SQLite schema of the tables the GitHub event source owns in Manifold's
-- database file, beside the store's and the router's tables and migrated
-- under the owner github.

CREATE TABLE github_delivery (
  delivery_id TEXT PRIMARY KEY CHECK (length(delivery_id) > 0),
  hook_id INTEGER NOT NULL CHECK (hook_id > 0),
  event TEXT NOT NULL,
  received_at INTEGER NOT NULL
) STRICT, WITHOUT ROWID;

CREATE TABLE github_redelivery (
  delivery_id TEXT PRIMARY KEY CHECK (length(delivery_id) > 0),
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
  node_id TEXT NOT NULL CHECK (length(node_id) > 0),
  requested_at INTEGER NOT NULL,
  generation INTEGER NOT NULL CHECK (generation > 0),
  project_node_id TEXT,
  PRIMARY KEY (kind, node_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX github_pending_requested ON github_pending (requested_at);

CREATE TABLE github_project (
  project_node_id TEXT PRIMARY KEY CHECK (length(project_node_id) > 0),
  owner TEXT NOT NULL CHECK (length(owner) > 0),
  number INTEGER NOT NULL CHECK (number > 0),
  closed INTEGER NOT NULL CHECK (closed IN (0, 1)),
  revision INTEGER NOT NULL CHECK (revision >= 0)
) STRICT, WITHOUT ROWID;

CREATE UNIQUE INDEX github_project_owner_number
  ON github_project (owner COLLATE NOCASE, number);

CREATE TABLE github_item (
  item_node_id TEXT PRIMARY KEY CHECK (length(item_node_id) > 0),
  project_node_id TEXT NOT NULL,
  content_type TEXT NOT NULL
    CHECK (content_type IN ('issue', 'pull-request', 'draft-issue')),
  content_node_id TEXT NOT NULL,
  present INTEGER NOT NULL CHECK (present IN (0, 1)),
  archived INTEGER NOT NULL CHECK (archived IN (0, 1)),
  revision INTEGER NOT NULL CHECK (revision >= 0)
) STRICT, WITHOUT ROWID;

CREATE INDEX github_item_project ON github_item (project_node_id);
CREATE INDEX github_item_content ON github_item (content_node_id);

CREATE TABLE github_field_value (
  item_node_id TEXT NOT NULL,
  field_node_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  value TEXT CHECK (value IS NULL OR json_valid(value)),
  revision INTEGER NOT NULL CHECK (revision >= 0),
  PRIMARY KEY (item_node_id, field_node_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE github_issue (
  issue_node_id TEXT PRIMARY KEY CHECK (length(issue_node_id) > 0),
  repository TEXT NOT NULL CHECK (instr(repository, '/') > 1),
  number INTEGER NOT NULL CHECK (number > 0),
  state TEXT NOT NULL CHECK (state IN ('open', 'closed')),
  state_reason TEXT
    CHECK (state_reason IN ('completed', 'not_planned', 'duplicate', 'reopened')),
  baselined INTEGER NOT NULL CHECK (baselined IN (0, 1)),
  revision INTEGER NOT NULL CHECK (revision >= 0)
) STRICT, WITHOUT ROWID;

CREATE TABLE github_dependency (
  blocked_node_id TEXT NOT NULL,
  blocking_node_id TEXT NOT NULL,
  present INTEGER NOT NULL CHECK (present IN (0, 1)),
  revision INTEGER NOT NULL CHECK (revision >= 0),
  PRIMARY KEY (blocked_node_id, blocking_node_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX github_dependency_blocking ON github_dependency (blocking_node_id);

CREATE TABLE github_sub_issue (
  parent_node_id TEXT NOT NULL,
  sub_issue_node_id TEXT NOT NULL,
  present INTEGER NOT NULL CHECK (present IN (0, 1)),
  revision INTEGER NOT NULL CHECK (revision >= 0),
  PRIMARY KEY (parent_node_id, sub_issue_node_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX github_sub_issue_sub ON github_sub_issue (sub_issue_node_id);
`,
  `ALTER TABLE github_issue ADD COLUMN present INTEGER NOT NULL DEFAULT 1 CHECK (present IN (0, 1));`,
  String.raw`CREATE TABLE github_card_move (
  actor_id TEXT NOT NULL CHECK (length(actor_id) > 0),
  invoke_id TEXT NOT NULL CHECK (length(invoke_id) > 0),
  entry_id TEXT NOT NULL CHECK (length(entry_id) > 0),
  item_node_id TEXT NOT NULL CHECK (length(item_node_id) > 0),
  field_node_id TEXT NOT NULL CHECK (length(field_node_id) > 0),
  option_id TEXT NOT NULL CHECK (length(option_id) > 0),
  state TEXT NOT NULL CHECK (state IN ('sent', 'confirmed', 'doubtful')),
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  PRIMARY KEY (actor_id, invoke_id, entry_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX github_card_move_field ON github_card_move (item_node_id, field_node_id, sequence);
`,
];
