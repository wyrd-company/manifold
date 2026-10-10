// ---
// relationships:
//   verifies: usage-intake
//   references: t3code-environment-source
// ---
import { expect, it } from "vite-plus/test";
import { openStore } from "../store/index.ts";
import { migrations } from "./migrations.ts";
import { readThreadProject } from "./index.ts";
it("reads a thread project from the source partition without modifying its state", () => {
  const store = openStore({ path: ":memory:" });
  try {
    store.connection.migrate("tthree", migrations);
    const db = store.connection.database;
    for (const environment of ["env-one", "env-two"])
      db.prepare("INSERT INTO t3_environment VALUES (?,?,?,?)").run(
        environment,
        "identity-" + environment,
        0,
        0,
      );
    db.prepare(
      "INSERT INTO t3_thread (environment, thread_id, status, cursor, thread, project_id) VALUES (?,?,?,?,?,?)",
    ).run("env-one", "thread-1", "followed", 0, "{}", "project-1");
    db.prepare(
      "INSERT INTO t3_thread (environment, thread_id, status, cursor, thread, project_id) VALUES (?,?,?,?,?,?)",
    ).run("env-two", "thread-1", "followed", 0, "{}", "project-2");
    expect(readThreadProject(store.connection, "env-one", "thread-1")).toBe("project-1");
    expect(readThreadProject(store.connection, "env-two", "thread-1")).toBe("project-2");
    expect(readThreadProject(store.connection, "env-one", "missing")).toBeUndefined();
  } finally {
    store.close();
  }
});
