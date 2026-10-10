// ---
// relationships:
//   verifies: [projects-api, task-metadata, service-assembly, github-event-source]
// ---
import { fork } from "node:child_process";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vite-plus/test";
import { childProcessLimit } from "../../../../test-support/limits.ts";
import { childArtifacts } from "../../../../test-support/child-process.ts";
import { serviceFixture } from "../service/test-fixtures/repository.ts";
test("SIGKILL after two field writes resumes Apply with no duplicate field or option", async () => {
  const f = await serviceFixture();
  const children: ReturnType<typeof fork>[] = [];
  try {
    f.api.fields.splice(0);
    await f.commit(60, {
      bindings: {
        githubProjects: {
          parcels: { owner: "sample", number: 1, environment: "local", item: "alpha" },
        },
      },
      taskMetadata: {
        projects: {
          parcels: {
            lifecycle: { field: "Stage", options: ["Packed", "Sent"] },
            fields: { mass: { type: "number" }, note: { type: "text" } },
          },
        },
      },
    });
    function worker(crash: boolean) {
      const child = fork(
        join(childArtifacts().service, "task-metadata/test-fixtures/project-config-worker.js"),
        [f.file, crash ? "crash" : "resume"],
        { silent: true, execArgv: [] },
      );
      children.push(child);
      let address: string | undefined;
      let stderr = "";
      child.on("message", (message: { address: string }) => {
        address = message.address;
      });
      child.stderr!.on("data", (chunk) => {
        stderr += String(chunk);
      });
      const exited = new Promise<{ code: number | null; signal: string | null }>((resolve) =>
        child.once("exit", (code, signal) => resolve({ code, signal })),
      );
      return {
        child,
        exited,
        async ready() {
          await expect
            .poll(
              () => {
                if (child.exitCode !== null || child.signalCode !== null) throw new Error(stderr);
                return address;
              },
              { timeout: childProcessLimit },
            )
            .toBeDefined();
          return address!;
        },
      };
    }
    async function waitProject(address: string) {
      await expect
        .poll(
          async () => {
            const result = await fetch(address + "/api/projects");
            return (await result.json()).projects[0]?.projectNodeId;
          },
          { timeout: childProcessLimit },
        )
        .toBe("P_one");
    }
    const first = worker(true);
    const firstAddress = await first.ready();
    await waitProject(firstAddress);
    const lost = fetch(firstAddress + "/api/projects/parcels/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"removeUndeclared":false}',
    }).catch(() => undefined);
    expect(await first.exited).toEqual({ code: null, signal: "SIGKILL" });
    await lost;
    expect(f.api.fields).toHaveLength(2);
    const ids = f.api.fields.map((f) => f.id);
    const db = new DatabaseSync(join(f.directory, "data/state.sqlite"));
    expect(db.prepare("SELECT count(*) AS n FROM metadata_project_applies").get()?.["n"]).toBe(0);
    db.close();
    const second = worker(false);
    const secondAddress = await second.ready();
    await waitProject(secondAddress);
    const apply = async () =>
      (
        await fetch(secondAddress + "/api/projects/parcels/apply", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: '{"removeUndeclared":false}',
        })
      ).json();
    expect(await apply()).toMatchObject({ writes: 1, configuration: { state: "in-sync" } });
    expect(f.api.fields).toHaveLength(3);
    expect(f.api.fields.slice(0, 2).map((f) => f.id)).toEqual(ids);
    expect(new Set(f.api.fields.flatMap((f) => f.options.map((o) => o.name))).size).toBe(2);
    expect(await apply()).toMatchObject({ writes: 0, outcome: "in-sync" });
    second.child.send("stop");
    expect(await second.exited).toEqual({ code: 0, signal: null });
  } finally {
    await Promise.all(
      children.map(
        (child) =>
          new Promise<void>((resolve) => {
            if (child.exitCode !== null || child.signalCode !== null) return resolve();
            child.once("exit", () => resolve());
            child.kill("SIGKILL");
          }),
      ),
    );
    await f.close();
  }
});
