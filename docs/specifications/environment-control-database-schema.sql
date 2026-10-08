-- ---
-- relationships:
--   realizes: environment-control-database-schema
-- ---
-- SQLite schema of the table the environment control module owns in
-- Manifold's database file, migrated under the owner `environment`.

CREATE TABLE environment_hold (
  environment TEXT PRIMARY KEY CHECK (length(environment) > 0),
  paused INTEGER NOT NULL CHECK (paused IN (0, 1)),
  disconnected INTEGER NOT NULL CHECK (disconnected IN (0, 1)),
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  changed_at INTEGER NOT NULL
) STRICT;
