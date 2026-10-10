// ---
// relationships:
//   verifies: [task-metadata, github-event-source]
// ---
import { fork } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vite-plus/test";
import { childArtifacts } from "../../../../test-support/child-process.ts";
import { repositoryFixture } from "./test-fixtures/repository.ts";
test("SIGKILL after repository writes restarts Apply without duplicating labels or milestones", async () => {
  const h = await repositoryFixture();
  h.addRepository("sample/warehouse");
  const directory = mkdtempSync(join(tmpdir(), "repository-apply-"));
  const path = join(directory, "store.sqlite");
  const children: ReturnType<typeof fork>[] = [];
  const worker = (mode: string) => {
    const child = fork(
      join(childArtifacts().service, "github-repository-fields/test-fixtures/apply-worker.js"),
      [path, h.apiUrl, mode],
      { silent: true, execArgv: [] },
    );
    children.push(child);
    let result: unknown;
    let stderr = "";
    child.on("message", (message) => {
      result = message;
    });
    child.stderr!.on("data", (chunk) => {
      stderr += String(chunk);
    });
    return new Promise<{ code: number | null; signal: string | null; result: unknown }>((resolve) =>
      child.once("exit", (code, signal) => {
        if (code) throw new Error(stderr);
        resolve({ code, signal, result });
      }),
    );
  };
  try {
    expect(await worker("crash")).toMatchObject({ code: null, signal: "SIGKILL" });
    const db = new DatabaseSync(path);
    expect(db.prepare("SELECT count(*) AS n FROM metadata_scope_applies").get()?.["n"]).toBe(0);
    db.close();
    expect(await worker("resume")).toMatchObject({
      code: 0,
      result: { first: { writes: 1, configuration: { state: "in-sync" } }, second: { writes: 0 } },
    });
    const scope = await h.adapters.observeScope({
      kind: "repository",
      repository: "sample/warehouse",
    });
    expect(scope).toMatchObject({
      labels: [{ name: "size: Small" }, { name: "size: Large" }],
      milestones: [{ title: "Spring" }],
    });
    expect(h.calls.filter((c) => c.method === "POST")).toHaveLength(3);
    expect(await worker("resume")).toMatchObject({
      code: 0,
      result: { first: { writes: 0 }, second: { writes: 0 } },
    });
  } finally {
    for (const child of children)
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await h.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
