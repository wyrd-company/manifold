// ---
// relationships:
//   realizes: t3code-source-database-schema
// ---
export const migrations = [
  String.raw`-- ---
-- relationships:
--   realizes: t3code-source-database-schema
-- ---
-- SQLite schema of the tables the T3 Code environment source owns in
-- Manifold's database file, migrated under the owner tthree.

CREATE TABLE t3_environment (
  environment TEXT NOT NULL PRIMARY KEY CHECK (length(environment) > 0),
  environment_id TEXT NOT NULL CHECK (length(environment_id) > 0),
  origin_sequence INTEGER NOT NULL CHECK (origin_sequence >= 0),
  shell_sequence INTEGER NOT NULL CHECK (shell_sequence >= origin_sequence)
) STRICT, WITHOUT ROWID;

CREATE TABLE t3_thread (
  environment TEXT NOT NULL REFERENCES t3_environment (environment) ON DELETE CASCADE,
  thread_id TEXT NOT NULL CHECK (length(thread_id) > 0),
  status TEXT NOT NULL CHECK (status IN ('followed', 'archived', 'deleted')),
  cursor INTEGER NOT NULL CHECK (cursor >= 0),
  thread TEXT NOT NULL CHECK (json_valid(thread)),
  PRIMARY KEY (environment, thread_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX t3_thread_followed ON t3_thread (environment, status);
`,
  String.raw`ALTER TABLE t3_thread ADD COLUMN project_id TEXT;
UPDATE t3_thread SET project_id = json_extract(thread, '$.projectId');
`,
  String.raw`ALTER TABLE t3_thread ADD COLUMN attribution TEXT NOT NULL
  DEFAULT '{"turnId":null,"messageId":null,"pendingMessageId":null}'
  CHECK (json_valid(attribution));
`,
  String.raw`CREATE TABLE t3_created_project (
  environment TEXT NOT NULL REFERENCES t3_environment (environment) ON DELETE CASCADE,
  project_id TEXT NOT NULL CHECK (length(project_id) > 0),
  actor_id TEXT NOT NULL CHECK (length(actor_id) > 0),
  item TEXT NOT NULL CHECK (length(item) > 0),
  PRIMARY KEY (environment, project_id)
) STRICT, WITHOUT ROWID;
`,
];
