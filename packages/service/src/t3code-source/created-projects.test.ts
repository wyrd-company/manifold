// ---
// relationships:
//   verifies: t3code-environment-source
// ---
import { expect, test } from "vite-plus/test";
import { openStore } from "../store/index.ts";
import { migrations } from "./migrations.ts";
import { createdProjects } from "./created-projects.ts";
test("presence and every thread status protect immutable creation provenance", () => {
  const store = openStore({ path: ":memory:" });
  try {
    store.connection.migrate("tthree", migrations);
    const db = store.connection.database;
    db.exec("INSERT INTO t3_environment VALUES ('local', 'server', 0, 0)");
    const records = createdProjects(store);
    const original = { environment: "local", projectId: "p1", actorId: "a1", item: "beta" };
    records.record(original);
    records.record({ ...original, actorId: "a2", item: "gamma" });
    expect(records.read("local", "p1")).toEqual(original);
    expect(records.all()[0]).toMatchObject({ presence: "unseen", threads: 0, retirable: false });
    records.snapshot("local", []);
    expect(records.all()[0]?.presence).toBe("unseen");
    records.snapshot("local", [{ id: "p1" }]);
    expect(records.all()[0]?.presence).toBe("listed");
    records.snapshot("local", []);
    expect(records.all()[0]?.retirable).toBe(true);
    records.presence("local", "p1", "listed");
    expect(records.all()[0]?.presence).toBe("removed");
    for (const status of ["followed", "archived", "deleted"]) {
      db.prepare(
        "INSERT INTO t3_thread (environment, thread_id, status, cursor, thread, project_id) VALUES ('local', ?, ?, 0, '{}', 'p1')",
      ).run(status, status);
      expect(records.all()[0]).toMatchObject({ retirable: false });
      db.prepare("DELETE FROM t3_thread WHERE thread_id = ?").run(status);
    }
    expect(records.all()[0]?.retirable).toBe(true);
    records.record({ ...original, projectId: "p2" });
    records.snapshot("local", [{ id: "p2", deletedAt: "removed" }]);
    expect(records.all()[1]?.presence).toBe("removed");
  } finally {
    store.close();
  }
});
