// ---
// relationships:
//   verifies: [intake, gate-runtime, escalations]
// ---
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { childArtifacts } from "../../../../test-support/child-process.ts";
import { spawnSync } from "node:child_process";
import { afterEach, expect, it } from "vite-plus/test";
import { openStore } from "../store/index.ts";
import { setup, files, issue, first } from "./test-fixtures/fixture.ts";
import { world } from "../gates/test-fixtures/world.ts";
import type { TrackedIssue } from "../github-source/index.ts";
const cleanup: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
});
const expression =
  'task.fields.Track.name = "Gears" ? {"blueprint":"missing.yml"} : {"blueprint":"blueprints/parcel.yml"}';
function killed(worker: string, mode: string) {
  const dir = mkdtempSync(join(tmpdir(), "service-failure-kill-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "store.sqlite");
  const child = spawnSync(process.execPath, [worker, path, mode], { encoding: "utf8" });
  expect(child.signal, child.stderr).toBe("SIGKILL");
  expect(child.status).toBeNull();
  return path;
}
it.each(["failed", "retry", "mirror", "untracked"])(
  "recovers intake after SIGKILL at %s without losing its failure or retry",
  async (mode) => {
    const path = killed("src/intake/test-fixtures/service-failure-worker.ts", mode);
    const before = openStore({ path });
    let population = [issue()];
    if (mode === "mirror" || mode === "untracked") {
      const current = JSON.parse(
        before.connection.database.prepare("SELECT issue FROM fixture_mirror").get()?.[
          "issue"
        ] as string,
      ) as TrackedIssue | null;
      population = current ? [current] : [];
    }
    expect(
      before.connection.database
        .prepare("SELECT status, attempts, issue_digest FROM intake_record")
        .get(),
    ).toMatchObject({
      status: "failed",
      attempts: 1,
      ...(mode === "retry" ? { issue_digest: null } : {}),
    });
    expect(
      before.connection.database
        .prepare("SELECT count(*) AS n FROM escalation WHERE status='open'")
        .get()?.["n"],
    ).toBe(mode === "retry" ? 0 : 1);
    before.close();
    const s = await setup(path, files(expression), {}, first, population);
    cleanup.push(() => s.close());
    await s.intake.idle();
    expect(s.intake.record("I1")).toMatchObject({
      status: mode === "mirror" ? "started" : "failed",
      attempts: mode === "retry" || mode === "mirror" ? 2 : 1,
    });
    expect(s.escalations.list({ status: "open" })).toHaveLength(
      mode === "mirror" || mode === "untracked" ? 0 : 1,
    );
    expect(s.host.starts).toHaveLength(mode === "mirror" ? 1 : 0);
  },
);
it("recovers one comparator escalation after SIGKILL between evaluation and the next actor save", async () => {
  const compiled = childArtifacts().service;
  const path = killed(
    join(compiled, "gates/test-fixtures/comparator-failure-worker.js"),
    "failure",
  );
  const before = openStore({ path });
  expect(
    before.connection.database
      .prepare("SELECT count(*) AS n FROM gates_evaluation WHERE outcome='failure'")
      .get()?.["n"],
  ).toBe(1);
  expect(
    before.connection.database
      .prepare("SELECT count(*) AS n FROM escalation WHERE status='open'")
      .get()?.["n"],
  ).toBe(1);
  expect(
    before.connection.database.prepare("SELECT count(*) AS n FROM gates_token").get()?.["n"],
  ).toBe(0);
  before.close();
  const f = await world(
    path,
    undefined,
    undefined,
    'export default () => { throw new Error("bad order"); }',
  );
  cleanup.push(f.close);
  expect(f.escalations.list({ status: "open" })).toHaveLength(1);
  expect(f.escalations.list({ status: "open" })[0]?.raiser).toMatchObject({ occurrence: 1 });
});
