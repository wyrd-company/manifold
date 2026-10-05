-- ---
-- relationships:
--   asset-of: task-metadata-tables
-- ---
-- The task metadata module's tables: the schema that its migration steps
-- produce. The store applies the steps with `migrate("metadata", steps)`
-- and records the version in `schema_migration`; the module runs no DDL.

-- One row per accepted declaration whose content differs from the row
-- before it. The row with the greatest `seq` is the declaration in force.
-- `declaration` is the canonical JSON (keys sorted) of the declaration
-- `lintTaskMetadataDeclaration` returns.
CREATE TABLE metadata_declarations (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  commit_id TEXT NOT NULL CHECK (length(commit_id) > 0),
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
  commit_id TEXT PRIMARY KEY CHECK (length(commit_id) > 0),
  findings TEXT NOT NULL CHECK (json_valid(findings)),
  rejected_at INTEGER NOT NULL
) STRICT, WITHOUT ROWID;
