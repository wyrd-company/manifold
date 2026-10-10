// ---
// relationships:
//   verifies: [declarations-api, portfolio, usage-intake]
// ---
import { fork } from "node:child_process";
import { once } from "node:events";
import { join } from "node:path";
import * as fs from "node:fs/promises";
import git from "isomorphic-git";
import { expect, test } from "vite-plus/test";
import { childArtifacts } from "../../../../test-support/child-process.ts";
import { archiveFixture } from "../portfolio-api/test-fixtures/archive.ts";
import { sampleCall } from "./test-fixtures/usage.ts";
import { fixtureThread } from "../t3code-source/test-fixtures/server.ts";
import { startService } from "../service/index.ts";

test.each(["before", "committed", "pushed", "applied"])(
  "archive SIGKILL at %s converges after restart",
  async (step) => {
    const f = await archiveFixture(true);
    let restarted: Awaited<ReturnType<typeof startService>> | undefined;
    let child: ReturnType<typeof fork> | undefined;
    try {
      const db = f.service.store.connection.database;
      db.exec("INSERT INTO t3_environment VALUES ('local', 'server', 0, 0)");
      db.exec(
        "INSERT INTO t3_thread (environment, thread_id, status, cursor, thread, project_id) VALUES ('local', 'thread-one', 'followed', 0, '{}', 'p1')",
      );
      const thread = fixtureThread("thread-one");
      db.prepare("UPDATE t3_thread SET thread = ? WHERE thread_id = 'thread-one'").run(
        JSON.stringify({ ...thread, projectId: "p1" }),
      );
      f.service.t3code.recordCreatedProject({
        environment: "local",
        projectId: "p1",
        actorId: "a1",
        item: "beta",
      });
      const prices = await f.service.revisions.save({
        base: f.base,
        saveId: "c".repeat(32),
        message: "Sample prices",
        files: [
          {
            path: "prices.yml",
            text: "unit: usd\nmodels:\n  model-a: {standard: {input: 2, output: 8}}\n",
          },
        ],
      });
      if (prices.outcome === "conflict") throw Error("Expected prices");
      f.service.portfolio.ledger.credit({
        key: "sample-credit",
        account: "acct-a",
        window: "sample-window",
        opensAt: Date.parse("2026-01-01"),
        closesAt: Date.parse("2026-01-02"),
        amount: 1000000,
      });
      await f.service.stop();
      child = fork(
        join(childArtifacts().service, "declarations-api/test-fixtures/archive-worker.js"),
        [f.fixture.file, step],
        { stdio: ["ignore", "pipe", "pipe", "ipc"], execArgv: [] },
      );
      let stderr = "";
      child.stderr?.on("data", (data) => (stderr += String(data)));
      const address = await new Promise<{ host: string; port: number }>((resolve, reject) => {
        child!.once("message", (message) => resolve(message as { host: string; port: number }));
        child!.once("exit", (code, signal) => reject(Error(`Exited ${code}/${signal}: ${stderr}`)));
        child!.once("error", reject);
      });
      const request = {
        item: "beta",
        base: prices.commit,
        saveId: "b".repeat(32),
        message: "Archive sample",
        projects: [
          { binding: "board-one", choice: "move" },
          { binding: "board-two", choice: "archive" },
          { created: { environment: "local", project: "p1" }, name: "chosen", choice: "move" },
        ],
      };
      const post = (url: string) =>
        fetch(url + "/api/declarations/archive-item", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request),
        });
      const exited = once(child, "exit");
      await post(`http://${address.host}:${address.port}`).catch(() => {});
      expect(await exited).toEqual([null, "SIGKILL"]);
      if (step === "before" || step === "committed")
        expect(await git.resolveRef({ fs, gitdir: f.fixture.remote.gitdir, ref: "main" })).toBe(
          prices.commit,
        );
      restarted = await startService({ configurationFile: f.fixture.file, log: () => {} });
      const url = `http://${restarted.http.address().host}:${restarted.http.address().port}`;
      const response = await post(url);
      expect(response.status).toBe(200);
      const saved = await response.json();
      expect(["saved", "already-saved"]).toContain(saved.outcome);
      expect(await (await post(url)).json()).toMatchObject({
        outcome: "already-saved",
        commit: saved.commit,
      });
      const log = await git.log({ fs, gitdir: f.fixture.remote.gitdir, ref: "main" });
      expect(log.filter((c) => c.commit.message.startsWith("Archive sample"))).toHaveLength(1);
      const usage = await fetch(url + "/api/usage/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          environment: "local",
          threads: [
            { provider: "codex", providerSessionId: "session-one", threadId: "thread-one" },
          ],
          records: [sampleCall("after", "session-one")],
        }),
      });
      expect(usage.status).toBe(200);
      expect(
        restarted.store.connection.database
          .prepare("SELECT item, status FROM usage_postings WHERE call_key = 'after'")
          .get(),
      ).toMatchObject({ item: "alpha/other", status: "posted" });
      expect(restarted.portfolio.createdProjects()[0]).toMatchObject({
        createdItem: "beta",
        usageItem: "alpha/other",
        resolution: { via: "binding" },
      });
      expect(
        (await fetch(url + "/api/declarations/bindings").then((r) => r.json())).createdProjects,
      ).toEqual([]);
      expect(restarted.t3code.createdProject("local", "p1")).toEqual({
        environment: "local",
        projectId: "p1",
        actorId: "a1",
        item: "beta",
      });
    } finally {
      if (child && child.exitCode === null && child.signalCode === null) {
        const exit = once(child, "exit");
        child.kill("SIGKILL");
        await exit;
      }
      await restarted?.stop();
      await f.close();
    }
  },
);
