-- ---
-- relationships:
--   realizes: router-database-schema
-- ---
-- SQLite schema of the tables the router owns in Manifold's database file,
-- beside the store's tables and migrated under the owner `router`.

CREATE TABLE router_source_event (
  source TEXT NOT NULL CHECK (length(source) > 0),
  event_id TEXT NOT NULL CHECK (length(event_id) > 0),
  accepted_at INTEGER NOT NULL,
  PRIMARY KEY (source, event_id)
) STRICT, WITHOUT ROWID;
