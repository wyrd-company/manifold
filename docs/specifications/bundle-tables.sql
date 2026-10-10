-- ---
-- relationships:
--   asset-of: bundle-tables
-- ---
-- The bundle module's tables: the schema that its migration steps produce.
-- The store applies the steps with `migrate("bundle", steps)` and records
-- the version in `schema_migration`; the module runs no DDL.

-- One row per bundle the service has run with, by digest.
CREATE TABLE bundle (
  digest TEXT PRIMARY KEY CHECK (length(digest) = 64 AND digest NOT GLOB '*[^0-9a-f]*'),
  recorded_at INTEGER NOT NULL
) STRICT;

-- One row per bundled blueprint of a bundle: its path and its text.
CREATE TABLE bundle_file (
  digest TEXT NOT NULL REFERENCES bundle (digest),
  path TEXT NOT NULL CHECK (substr(CAST(path AS BLOB), 1, 11) = CAST('blueprints/' AS BLOB)),
  text TEXT NOT NULL,
  PRIMARY KEY (digest, path)
) STRICT;

CREATE TRIGGER bundle_immutable BEFORE UPDATE ON bundle
BEGIN
  SELECT RAISE(ABORT, 'bundle rows are immutable');
END;

CREATE TRIGGER bundle_kept BEFORE DELETE ON bundle
BEGIN
  SELECT RAISE(ABORT, 'bundle rows are never deleted');
END;

CREATE TRIGGER bundle_file_immutable BEFORE UPDATE ON bundle_file
BEGIN
  SELECT RAISE(ABORT, 'bundle_file rows are immutable');
END;

CREATE TRIGGER bundle_file_kept BEFORE DELETE ON bundle_file
BEGIN
  SELECT RAISE(ABORT, 'bundle_file rows are never deleted');
END;
