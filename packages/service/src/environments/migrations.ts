// ---
// relationships:
//   implements: environment-control-database-schema
// ---
export const migrations = [
  String.raw`
CREATE TABLE environment_hold (
  environment TEXT PRIMARY KEY CHECK (environment <> ''),
  paused INTEGER NOT NULL CHECK (paused IN (0, 1)),
  disconnected INTEGER NOT NULL CHECK (disconnected IN (0, 1)),
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  changed_at INTEGER NOT NULL
) STRICT;
`,
];
