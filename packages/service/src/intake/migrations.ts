// ---
// relationships:
//   implements: intake-records-table
// ---
export const intakeMigrationSteps: readonly string[] = [
  `-- ---
-- relationships:
--   asset-of: intake-records-table
-- ---
-- The intake module's table: the schema that its migration steps produce.
-- The store applies the steps with \`migrate("intake", steps)\` and records
-- the version in \`schema_migration\`; the module runs no DDL.

-- One row per issue intake has decided or failed to decide. A \`recorded\` or
-- \`started\` row holds the issue's one decision; a \`failed\` row holds the
-- commit it failed at and the digest of the tracked issue it was decided
-- over, and is decided again at a later commit, at a change of the issue,
-- or when its digest is cleared for a retry.
CREATE TABLE intake_record (
  issue_node_id TEXT PRIMARY KEY CHECK (issue_node_id <> ''),
  status TEXT NOT NULL CHECK (status IN ('failed', 'recorded', 'started')),
  commit_id TEXT NOT NULL CHECK (length(commit_id) = 40),
  binding TEXT,
  project_node_id TEXT,
  project_owner TEXT,
  project_number INTEGER CHECK (project_number IS NULL OR project_number > 0),
  environment TEXT,
  blueprint_path TEXT,
  blueprint_version TEXT,
  portfolio_item TEXT,
  portfolio_commit TEXT,
  actor_id TEXT NOT NULL CHECK (actor_id = 'task:' || issue_node_id),
  failure TEXT CHECK (failure IS NULL OR json_valid(failure)),
  evaluation TEXT CHECK (evaluation IS NULL OR json_valid(evaluation)),
  attempts INTEGER NOT NULL CHECK (attempts >= 0),
  start_failure TEXT CHECK (start_failure IS NULL OR json_valid(start_failure)),
  start_attempts INTEGER NOT NULL DEFAULT 0 CHECK (start_attempts >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  issue_digest TEXT CHECK (issue_digest IS NULL OR (length(issue_digest) = 64 AND issue_digest NOT GLOB '*[^0-9a-f]*')),
  CHECK (status = 'recorded' OR start_failure IS NULL),
  CHECK (
    (status = 'failed' AND failure IS NOT NULL)
    OR (
      status IN ('recorded', 'started')
      AND failure IS NULL
      AND binding IS NOT NULL
      AND project_node_id IS NOT NULL
      AND project_owner IS NOT NULL
      AND project_number IS NOT NULL
      AND environment IS NOT NULL
      AND blueprint_path IS NOT NULL
      AND blueprint_version IS NOT NULL
      AND portfolio_item IS NOT NULL
      AND evaluation IS NOT NULL
    )
  )
) STRICT, WITHOUT ROWID;

-- A decision once recorded never changes. A \`recorded\` row moves only to
-- \`started\`, or stays \`recorded\` while a start failure is recorded on it,
-- with every decision column kept. A \`started\` row never changes.
CREATE TRIGGER intake_record_decided
  BEFORE UPDATE ON intake_record
  WHEN OLD.status <> 'failed'
    AND NOT (
      OLD.status = 'recorded'
      AND NEW.status IN ('recorded', 'started')
      AND NEW.issue_node_id IS OLD.issue_node_id
      AND NEW.actor_id IS OLD.actor_id
      AND NEW.commit_id IS OLD.commit_id
      AND NEW.binding IS OLD.binding
      AND NEW.project_node_id IS OLD.project_node_id
      AND NEW.project_owner IS OLD.project_owner
      AND NEW.project_number IS OLD.project_number
      AND NEW.environment IS OLD.environment
      AND NEW.blueprint_path IS OLD.blueprint_path
      AND NEW.blueprint_version IS OLD.blueprint_version
      AND NEW.portfolio_item IS OLD.portfolio_item
      AND NEW.portfolio_commit IS OLD.portfolio_commit
      AND NEW.evaluation IS OLD.evaluation
      AND NEW.failure IS OLD.failure
      AND NEW.attempts IS OLD.attempts
      AND NEW.created_at IS OLD.created_at
      AND NEW.issue_digest IS OLD.issue_digest
    )
  BEGIN SELECT RAISE(ABORT, 'intake_record decision is final'); END;

CREATE TRIGGER intake_record_no_delete
  BEFORE DELETE ON intake_record
  BEGIN SELECT RAISE(ABORT, 'intake_record rows are never deleted'); END;
`,
];
