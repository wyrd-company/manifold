-- ---
-- relationships:
--   realizes: router-database-schema
-- ---
-- SQLite schema of the tables the router owns in Manifold's database file,
-- beside the store's tables and migrated under the owner `router`.

CREATE TABLE router_source_event (
  source TEXT NOT NULL CHECK (source <> ''),
  event_id TEXT NOT NULL CHECK (event_id <> ''),
  accepted_at INTEGER NOT NULL,
  PRIMARY KEY (source, event_id)
) STRICT, WITHOUT ROWID;

-- Each source's events in the order they were accepted, read by retention.
CREATE INDEX router_source_event_by_time ON router_source_event (source, accepted_at);
