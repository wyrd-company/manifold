// ---
// relationships:
//   implements: bundle-tables
// ---
export const bundleMigrationSteps: readonly string[] = [
  `
CREATE TABLE bundle (
  digest TEXT PRIMARY KEY CHECK (length(digest) = 64 AND digest NOT GLOB '*[^0-9a-f]*'),
  recorded_at INTEGER NOT NULL
) STRICT;

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
END;`,
];
