// ---
// relationships:
//   implements: environment-control-database-schema
// ---
import type { Store } from "../store/index.ts";
import type { EnvironmentHold } from "../t3code-source/index.ts";
export function holdsStore(store: Store) {
  const database = store.connection.database;
  const write = database.prepare(
    "INSERT INTO environment_hold(environment,paused,disconnected,sequence,changed_at) VALUES(?,?,?,?,?) ON CONFLICT(environment) DO UPDATE SET paused=excluded.paused,disconnected=excluded.disconnected,sequence=excluded.sequence,changed_at=excluded.changed_at",
  );
  return {
    read() {
      return new Map(
        database
          .prepare("SELECT * FROM environment_hold")
          .all()
          .map((row) => [
            String(row["environment"]),
            Object.freeze({
              paused: row["paused"] === 1,
              disconnected: row["disconnected"] === 1,
              sequence: Number(row["sequence"]),
            }),
          ]),
      );
    },
    write(environment: string, hold: EnvironmentHold, at: number) {
      write.run(environment, Number(hold.paused), Number(hold.disconnected), hold.sequence, at);
    },
  };
}
