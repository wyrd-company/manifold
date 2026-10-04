// ---
// relationships:
//   verifies: intake
// ---
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { spawnSync } from "node:child_process";
import { afterEach, expect, it } from "vite-plus/test";
import { setup, first, second, files } from "./test-fixtures/fixture.ts";
const cleanup: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
});
it.each(["recorded", "snapshot"])(
  "recovers one actor after SIGKILL at %s on the recorded version",
  async (step) => {
    const dir = mkdtempSync(join(tmpdir(), "intake-kill-"));
    cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
    const path = join(dir, "store.sqlite");
    const killed = spawnSync(
      process.execPath,
      ["src/intake/test-fixtures/crash-worker.ts", path, step],
      { encoding: "utf8" },
    );
    expect(killed.signal, killed.stderr).toBe("SIGKILL");
    expect(killed.status).toBeNull();
    const db = new DatabaseSync(path);
    expect(db.prepare("SELECT status, commit_id FROM intake_record").get()).toMatchObject({
      status: "recorded",
      commit_id: first,
    });
    db.close();
    const s = await setup(path, files(), {}, second);
    cleanup.push(() => s.close());
    const old = s.intake.record("I1")!;
    expect(old).toMatchObject({
      commit: first,
      blueprintVersion: first + ":blueprints/parcel.yml",
    });
    // The real host reloads the recorded version while the follower publishes B.
    s.intake.revisionLoaded();
    await s.intake.idle();
    expect(s.intake.record("I1")).toMatchObject({ status: "started", commit: first, attempts: 1 });
    expect(s.host.starts).toHaveLength(step === "snapshot" ? 0 : 1);
    expect(
      s.store.connection.database.prepare("SELECT count(*) AS count FROM intake_record").get()?.[
        "count"
      ],
    ).toBe(1);
    expect(s.store.loadSnapshot("task:I1")).toMatchObject({
      machine: first + ":blueprints/parcel.yml",
    });
    expect(s.store.activeSnapshots()).toHaveLength(1);
    expect(s.host.host.actorOf("task:I1")).toMatchObject({
      commit: first,
      manifold: { issue: "I1", portfolioItem: "beta" },
    });
    expect(s.store.loadSnapshot("task:I1")?.snapshot["entries"]).toMatchObject({ count: 2 });
  },
);
