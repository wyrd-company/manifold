// ---
// relationships:
//   verifies: gate-runtime
// ---
import { childArtifacts } from "../../../../test-support/child-process.ts";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vite-plus/test";
import { openStore } from "../store/index.ts";
import { world } from "./test-fixtures/world.ts";
// Four kill boundaries and their fresh/recovered worlds take 35.2 s under CPU load.
it("SIGKILL at granting, granted, sent, and saved recovers exactly one held token and reservation", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gate-crash-"));
  try {
    const compiled = childArtifacts().service;
    for (const point of ["granting", "granted", "sent", "saved"]) {
      const file = join(dir, `${point}.sqlite`);
      const child = spawnSync(
        process.execPath,
        [join(compiled, "gates/test-fixtures/crash-worker.js"), file, point],
        { encoding: "utf8" },
      );
      expect(child.error, child.stderr).toBeUndefined();
      expect(child.signal, child.stderr).toBe("SIGKILL");
      const recovered = openStore({ path: file });
      try {
        const count = point === "granting" ? 0 : 1;
        for (const query of [
          "SELECT count(*) AS n FROM gates_token",
          "SELECT count(*) AS n FROM gates_evaluation WHERE outcome='selection'",
          "SELECT count(*) AS n FROM ledger_entries WHERE kind='reserve'",
          "SELECT count(*) AS n FROM store_inbox WHERE topic='gate'",
        ])
          expect(
            recovered.connection.database.prepare(query).get()?.["n"],
            `${point}: ${query}`,
          ).toBe(count);
        expect(recovered.loadSnapshot("parcel-00")?.snapshot["context"]).toMatchObject({
          seen: [],
        });
      } finally {
        recovered.close();
      }
      const resumed = await world(file);
      try {
        const { store, ledger, gates } = resumed;
        expect(
          store.connection.database
            .prepare("SELECT actor_id FROM gates_token WHERE returned_at IS NULL")
            .all(),
        ).toEqual([{ actor_id: "parcel-00" }]);
        expect(ledger.actorUsage("parcel-00").accounts[0]?.outstanding).toBe(5);
        expect(store.loadSnapshot("parcel-00")?.snapshot["context"]).toMatchObject({
          seen: ["token:1"],
        });
        expect(store.pendingInbox("parcel-00")).toEqual([]);
        gates.afterDrain(resumed.router);
        expect(
          store.connection.database.prepare("SELECT count(*) AS n FROM gates_token").get()?.["n"],
        ).toBe(1);
        // Return the first holder and prove the next grant follows comparator order.
        store.connection.transaction(() => {
          store.saveSnapshot({
            actorId: "parcel-00",
            machine: store.loadSnapshot("parcel-00")!.machine,
            snapshot: { status: "done", value: "finished" },
          });
          gates.saved({
            actorId: "parcel-00",
            machine: store.loadSnapshot("parcel-00")!.machine,
            snapshot: { status: "done", value: "finished" },
            activeInvokes: [],
            entered: [],
            entries: {},
          });
        });
        gates.afterDrain(resumed.router);
        expect(
          store.connection.database
            .prepare("SELECT actor_id FROM gates_token WHERE returned_at IS NULL")
            .all(),
        ).toEqual([{ actor_id: "parcel-01" }]);
        expect(ledger.actorUsage("parcel-01").accounts[0]?.outstanding).toBe(5);
      } finally {
        resumed.close();
      }
      const again = await world(file);
      try {
        expect(
          again.store.connection.database.prepare("SELECT count(*) AS n FROM gates_token").get()?.[
            "n"
          ],
        ).toBe(2);
        expect(again.ledger.actorUsage("parcel-00").accounts[0]?.outstanding).toBe(5);
      } finally {
        again.close();
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 60_000);
