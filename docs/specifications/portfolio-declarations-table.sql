-- ---
-- relationships:
--   asset-of: portfolio-declarations-table
-- ---
-- The portfolio module's table: the schema that its migration steps
-- produce. The store applies the steps with `migrate("portfolio", steps)`
-- and records the version in `schema_migration`; the module runs no DDL.

-- One row per accepted declaration whose content differs from the row
-- before it. The row with the greatest `seq` is the declaration in force.
-- `declaration` is the canonical JSON (keys sorted) of the normalized
-- declaration: the ledger portfolio input, the items, and the bindings.
CREATE TABLE portfolio_declarations (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  commit_id TEXT NOT NULL CHECK (commit_id <> ''),
  declaration TEXT NOT NULL CHECK (json_valid(declaration)),
  accepted_at INTEGER NOT NULL
) STRICT;

CREATE TRIGGER portfolio_declarations_no_update
  BEFORE UPDATE ON portfolio_declarations
  BEGIN SELECT RAISE(ABORT, 'portfolio_declarations is append-only'); END;
CREATE TRIGGER portfolio_declarations_no_delete
  BEFORE DELETE ON portfolio_declarations
  BEGIN SELECT RAISE(ABORT, 'portfolio_declarations is append-only'); END;
