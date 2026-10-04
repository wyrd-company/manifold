// ---
// relationships:
//   verifies: actor-host
// ---
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { openStore } from "../store/index.ts";

const worker = new URL("./test-fixtures/crash-worker.ts", import.meta.url);
test.each(["sent", "promise"])(
  "SIGKILL at %s resumes parallel regions, promise, and child delay exactly once",
  (mode) => {
    const directory = mkdtempSync(join(tmpdir(), "actor-crash-"));
    try {
      const run = (path: string, mode: string) =>
        spawnSync(process.execPath, [worker.pathname, path, mode], { encoding: "utf8" });
      const baseline = join(directory, "baseline.sqlite"),
        crashed = join(directory, "crashed.sqlite");
      const uninterrupted = run(baseline, "baseline");
      expect(uninterrupted.stderr).toBe("");
      expect(uninterrupted.status).toBe(0);
      const killed = run(crashed, mode);
      expect(killed.signal).toBe("SIGKILL");
      const interrupted = openStore({ path: crashed });
      try {
        expect(interrupted.loadSnapshot("parcel")?.snapshot).toMatchObject({
          status: "active",
          value: mode === "sent" ? "waiting" : { sorting: { courier: "waiting" } },
        });
      } finally {
        interrupted.close();
      }
      const resume = run(crashed, "resume");
      expect(resume.stderr).toBe("");
      expect(resume.status).toBe(0);
      const read = (path: string) => {
        const store = openStore({ path });
        try {
          return {
            snapshot: store.loadSnapshot("parcel")?.snapshot,
            inbox: store.pendingInbox("parcel"),
            calls: store.connection.database.prepare("SELECT * FROM test_effect ORDER BY id").all(),
            taken: store.connection.database
              .prepare(
                "SELECT event_id, count(*) AS count FROM store_inbox WHERE actor_id = 'parcel' AND consumed_at IS NOT NULL GROUP BY event_id ORDER BY event_id",
              )
              .all(),
          };
        } finally {
          store.close();
        }
      };
      const expected = read(baseline);
      expect(expected.snapshot).toMatchObject({ status: "done", value: "delivered" });
      expect(expected.calls).toHaveLength(1);
      expect(expected.inbox).toEqual([]);
      expect(expected.taken).toHaveLength(3);
      expect(expected.taken.every((row) => row["count"] === 1)).toBe(true);
      expect(read(crashed)).toEqual(expected);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
