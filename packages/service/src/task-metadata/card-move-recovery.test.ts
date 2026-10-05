// ---
// relationships:
//   verifies: [task-metadata, service-assembly, github-event-source, actor-host]
// ---
import { fork, execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { writeFile, symlink } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vite-plus/test";
import { serviceFixture } from "../service/test-fixtures/repository.ts";
test("SIGKILL after mutation confirmation restores the invoke, converges, and the blueprint distinguishes own and person moves", async () => {
  const f = await serviceFixture();
  const children: ReturnType<typeof fork>[] = [];
  try {
    f.api.addItem("IT_A", "I_A");
    f.api.items.get("IT_A")!.fieldValues.nodes = [
      {
        field: { id: "F_stage", name: "Stage", dataType: "SINGLE_SELECT" },
        optionId: "O_sorting",
        name: "Sorting",
      },
    ];
    await f.commit(
      60,
      {
        bindings: {
          githubProjects: {
            parcels: { owner: "sample", number: 1, environment: "local", item: "alpha" },
          },
        },
        taskMetadata: {
          projects: { parcels: { lifecycle: { field: "Stage", options: ["Packed"] } } },
        },
      },
      {
        schemas: {
          input: true,
          output: true,
          context: true,
          events: { "github.project-item.field-changed": true },
          actors: { "github-card-move": { input: true, output: true } },
        },
        machine: {
          initial: "packing",
          states: {
            packing: {
              invoke: {
                id: "stage",
                src: "github-card-move",
                input: { status: "Packed" },
                onDone: "waiting",
                onError: "failed",
              },
            },
            waiting: {
              on: {
                "github.project-item.field-changed": [
                  {
                    guard: {
                      type: "expression.guard",
                      params: { expression: "event.movedBy.confirmed = true" },
                    },
                    target: "own",
                  },
                  {
                    guard: {
                      type: "expression.guard",
                      params: { expression: "event.movedBy = null" },
                    },
                    target: "person",
                  },
                ],
              },
            },
            own: {
              on: {
                "github.project-item.field-changed": {
                  guard: {
                    type: "expression.guard",
                    params: { expression: "event.movedBy = null" },
                  },
                  target: "person",
                },
              },
            },
            person: {},
            failed: { type: "final" },
            done: { type: "final" },
          },
        },
      },
    );
    const serviceRoot = fileURLToPath(new URL("../..", import.meta.url));
    const compiled = join(f.directory, "compiled");
    const configuration = join(f.directory, "tsconfig.json");
    await writeFile(
      configuration,
      JSON.stringify({
        extends: join(serviceRoot, "tsconfig.build.json"),
        compilerOptions: {
          outDir: compiled,
          declaration: false,
          typeRoots: [join(serviceRoot, "node_modules/@types")],
        },
        files: [join(serviceRoot, "src/task-metadata/test-fixtures/card-move-worker.ts")],
      }),
    );
    await promisify(execFile)(join(serviceRoot, "node_modules/.bin/tsc"), ["-p", configuration]);
    await symlink(join(serviceRoot, "node_modules"), join(f.directory, "node_modules"));
    await writeFile(join(f.directory, "package.json"), '{"type":"module"}');
    function worker(crash: boolean) {
      const child = fork(
        join(compiled, "task-metadata/test-fixtures/card-move-worker.js"),
        [f.file, crash ? "crash" : "resume"],
        { silent: true, execArgv: [] },
      );
      children.push(child);
      let ready = false,
        stderr = "";
      child.on("message", () => {
        ready = true;
      });
      child.stderr!.on("data", (chunk) => {
        stderr += String(chunk);
      });
      const exited = new Promise<{ code: number | null; signal: string | null }>((resolve) =>
        child.once("exit", (code, signal) => resolve({ code, signal })),
      );
      return {
        child,
        stderr: () => stderr,
        exited,
        ready: async () => {
          await expect
            .poll(
              () => {
                if (child.exitCode !== null || child.signalCode !== null) throw new Error(stderr);
                return ready;
              },
              { timeout: 15000 },
            )
            .toBe(true);
        },
      };
    }
    const path = join(f.directory, "data/state.sqlite");
    function read(sql: string) {
      const db = new DatabaseSync(path);
      try {
        return db.prepare(sql).all();
      } finally {
        db.close();
      }
    }
    const first = worker(true);
    await first.ready();
    await expect.poll(() => read("SELECT * FROM github_item WHERE present=1").length).toBe(1);
    first.child.send("start");
    expect(await first.exited, first.stderr()).toEqual({ code: null, signal: "SIGKILL" });
    expect(
      JSON.parse(
        read("SELECT snapshot FROM store_snapshot WHERE actor_id='parcel'")[0]![
          "snapshot"
        ] as string,
      ).value,
    ).toBe("packing");
    expect(read("SELECT state FROM github_card_move")[0]!["state"]).toBe("confirmed");
    const second = worker(false);
    await second.ready();
    await expect
      .poll(
        () =>
          JSON.parse(
            read("SELECT snapshot FROM store_snapshot WHERE actor_id='parcel'")[0]![
              "snapshot"
            ] as string,
          ).value,
        { timeout: 10000 },
      )
      .toBe("own");
    expect(
      f.api.log
        .filter((row) => row.operation === "GitHubCardMove")
        .map((row) => row.variables["option"]),
    ).toEqual(["O_packed", "O_packed"]);
    expect(read("SELECT * FROM router_source_event WHERE event_id LIKE 'field:%'")).toHaveLength(1);
    f.api.items.get("IT_A")!.fieldValues.nodes[0]!["name"] = "Shipped";
    f.api.items.get("IT_A")!.fieldValues.nodes[0]!["optionId"] = "O_shipped";
    second.child.send("stop");
    await second.exited;
    // The next assembled start's sweep reads the person's change.
    const third = worker(false);
    await third.ready();
    await expect
      .poll(
        () =>
          JSON.parse(
            read("SELECT snapshot FROM store_snapshot WHERE actor_id='parcel'")[0]![
              "snapshot"
            ] as string,
          ).value,
      )
      .toBe("person");
    third.child.send("stop");
    expect(await third.exited).toEqual({ code: 0, signal: null });
  } finally {
    for (const child of children)
      if (child.exitCode === null && child.signalCode === null) {
        const exited = new Promise((resolve) => child.once("exit", resolve));
        child.kill("SIGKILL");
        await exited;
      }
    await f.close();
  }
}, 60000);
