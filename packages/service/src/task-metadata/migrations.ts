// ---
// relationships:
//   implements: task-metadata-tables
// ---
export const taskMetadataMigrationSteps: readonly string[] = [
  `-- ---
-- relationships:
--   asset-of: task-metadata-tables
-- ---
-- The task metadata module's tables: the schema that its migration steps
-- produce. The store applies the steps with \`migrate("metadata", steps)\`
-- and records the version in \`schema_migration\`; the module runs no DDL.

-- One row per accepted declaration whose content differs from the row
-- before it. The row with the greatest \`seq\` is the declaration in force.
-- \`declaration\` is the canonical JSON (keys sorted) of the declaration
-- \`lintTaskMetadataDeclaration\` returns.
CREATE TABLE metadata_declarations (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  commit_id TEXT NOT NULL CHECK (commit_id <> ''),
  declaration TEXT NOT NULL CHECK (json_valid(declaration)),
  accepted_at INTEGER NOT NULL
) STRICT;

CREATE TRIGGER metadata_declarations_no_update
  BEFORE UPDATE ON metadata_declarations
  BEGIN SELECT RAISE(ABORT, 'metadata_declarations is append-only'); END;
CREATE TRIGGER metadata_declarations_no_delete
  BEFORE DELETE ON metadata_declarations
  BEGIN SELECT RAISE(ABORT, 'metadata_declarations is append-only'); END;

-- One row per commit whose declaration had findings, with the findings.
CREATE TABLE metadata_rejections (
  commit_id TEXT PRIMARY KEY CHECK (commit_id <> ''),
  findings TEXT NOT NULL CHECK (json_valid(findings)),
  rejected_at INTEGER NOT NULL
) STRICT, WITHOUT ROWID;

-- The applied configuration of each binding on each Project: the Project's
-- custom fields as the observation that ended its last Apply read them.
-- Each completed Apply replaces its row.
CREATE TABLE metadata_project_applies (
  binding TEXT NOT NULL CHECK (binding <> ''),
  project_node_id TEXT NOT NULL CHECK (project_node_id <> ''),
  commit_id TEXT NOT NULL CHECK (commit_id <> ''),
  fields TEXT NOT NULL CHECK (json_valid(fields)),
  owned TEXT NOT NULL CHECK (json_valid(owned)),
  applied_at INTEGER NOT NULL,
  PRIMARY KEY (binding, project_node_id)
) STRICT, WITHOUT ROWID;

-- Per binding, the accept save an Apply pushed whose commit was not yet in
-- force, so a retry whose save rejects reports the commit without pushing.
CREATE TABLE metadata_pending_saves (
  binding TEXT PRIMARY KEY CHECK (binding <> ''),
  save_id TEXT NOT NULL CHECK (length(save_id) = 32),
  commit_id TEXT NOT NULL CHECK (commit_id <> ''),
  saved_at INTEGER NOT NULL
) STRICT, WITHOUT ROWID;

-- Applied configuration shared by every binding that reaches the scope.
CREATE TABLE metadata_scope_applies (
  scope_key TEXT PRIMARY KEY CHECK (scope_key <> ''),
  commit_id TEXT NOT NULL CHECK (commit_id <> ''),
  configuration TEXT NOT NULL CHECK (json_valid(configuration)),
  owned TEXT NOT NULL CHECK (json_valid(owned)),
  applied_at INTEGER NOT NULL
) STRICT, WITHOUT ROWID;
`,
];
