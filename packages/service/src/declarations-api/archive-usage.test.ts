// ---
// relationships:
//   verifies: [declarations-api, usage-intake, portfolio]
// ---
import { childProcessLimit } from "../../../../test-support/limits.ts";
import { expect, test } from "vite-plus/test";
import { sampleCall } from "./test-fixtures/usage.ts";
import type { UsageCall } from "@wyrd-company/manifold-shared";
import { archiveFixture } from "../portfolio-api/test-fixtures/archive.ts";

test(
  "new and late unowned calls follow archive bindings while posted history stays",
  async () => {
    const f = await archiveFixture(true);
    try {
      const db = f.service.store.connection.database;
      db.exec("INSERT INTO t3_environment VALUES ('local', 'server', 0, 0)");
      for (const project of ["p1", "p2", "p3", "workspace-one", "p8"]) {
        db.prepare(
          "INSERT INTO t3_thread (environment, thread_id, status, cursor, thread, project_id) VALUES ('local', ?, 'followed', 0, '{}', ?)",
        ).run(project, project);
        if (project !== "workspace-one")
          f.service.t3code.recordCreatedProject({
            environment: "local",
            projectId: project,
            actorId: "a1",
            item: project === "p8" ? "alpha/other" : "beta",
          });
      }
      const prices = await f.service.revisions.save({
        base: f.base,
        saveId: "8".repeat(32),
        message: "Declare sample prices",
        files: [
          {
            path: "prices.yml",
            text: "unit: usd\nmodels:\n  model-a: {standard: {input: 2, output: 8}}\n",
          },
        ],
      });
      if (prices.outcome === "conflict") throw Error("Unexpected conflict");
      f.service.portfolio.ledger.credit({
        key: "sample-credit",
        account: "acct-a",
        window: "sample-window",
        opensAt: Date.parse("2026-01-01"),
        closesAt: Date.parse("2026-01-02"),
        amount: 1000000,
      });
      const push = (
        records: UsageCall[],
        threads: { provider: "codex"; providerSessionId: string; threadId: string }[] = [],
      ) =>
        fetch(f.url + "/api/usage/push", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ environment: "local", records, threads }),
        });
      const mapping = (session: string, threadId = session) => ({
        provider: "codex" as const,
        providerSessionId: session,
        threadId,
      });
      const first = await push([sampleCall("before", "p1")], [mapping("p1")]);
      expect(first.status, JSON.stringify(await first.json())).toBe(200);
      expect((await push([sampleCall("late", "late")])).status).toBe(200);
      const before = db.prepare("SELECT item FROM usage_postings WHERE call_key = 'before'").get();
      expect(before?.["item"]).toBe("beta");
      const request = {
        item: "beta",
        base: prices.commit,
        saveId: "9".repeat(32),
        message: "Archive sample",
        projects: [
          { binding: "board-one", choice: "move" },
          { binding: "board-two", choice: "move" },
          ...["p1", "p2", "p3"].map((project, i) => ({
            created: { environment: "local", project },
            name: `chosen-${i + 1}`,
            choice: ["move", "reassign", "archive"][i],
            ...(i === 1 ? { item: "gamma" } : {}),
          })),
        ],
      };
      const saved = await fetch(f.url + "/api/declarations/archive-item", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      expect(saved.status).toBe(200);
      for (const project of ["p1", "p2", "p3", "workspace-one"])
        expect(
          (await push([sampleCall(`after-${project}`, project)], [mapping(project)])).status,
        ).toBe(200);
      expect((await push([], [mapping("late", "p1")])).status).toBe(200);
      for (const [key, item] of [
        ["before", "beta"],
        ["after-p1", "alpha/other"],
        ["after-p2", "gamma"],
        ["after-p3", "beta"],
        ["after-workspace-one", "alpha/other"],
      ] as const)
        expect(
          db.prepare("SELECT item FROM usage_postings WHERE call_key = ?").get(key)?.["item"],
        ).toBe(item);
      expect(
        db
          .prepare(
            "SELECT attributed_item AS item FROM usage_attributed_postings WHERE call_key = 'late'",
          )
          .get()?.["item"],
      ).toBe("alpha/other");
      const p8 = {
        item: "alpha",
        base: f.service.processRepository.current()!.commit,
        saveId: "a".repeat(32),
        message: "Archive parent",
        projects: [
          { binding: "board-one", choice: "archive" },
          { binding: "board-two", choice: "archive" },
          { binding: "chosen-1", choice: "archive" },
          { binding: "chosen-2", choice: "archive" },
          {
            created: { environment: "local", project: "p8" },
            name: "chosen-other",
            choice: "archive",
          },
        ],
      };
      expect((await push([sampleCall("other-before", "p8")], [mapping("p8")])).status).toBe(200);
      const response = await fetch(f.url + "/api/declarations/archive-item", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(p8),
      });
      expect(response.status, JSON.stringify(await response.json())).toBe(200);
      expect((await push([sampleCall("other-after", "p8")])).status).toBe(200);
      for (const key of ["other-before", "other-after"])
        expect(
          db.prepare("SELECT item FROM usage_postings WHERE call_key = ?").get(key)?.["item"],
        ).toBe("alpha/other");
    } finally {
      await f.close();
    }
  },
  childProcessLimit * 2,
);
