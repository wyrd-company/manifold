// ---
// relationships:
//   verifies: projects-api
// ---
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { memoryRevision } from "@wyrd-company/manifold-shared";
import { openTaskMetadata, taskMetadataMigrationSteps } from "./index.ts";
import { openStore } from "../store/index.ts";
import type { SaveRequest } from "../process-repository/index.ts";
import type { ProjectField, ProjectFieldWrite } from "../github-source/index.ts";
const bindings =
  "githubProjects: { parcels: { owner: sample, number: 1, environment: local, item: shipments } }";
const text =
  "# keep this comment\nprojects:\n  parcels:\n    lifecycle: { field: Stage, options: [Packed, Sent] }\n    fields:\n      mass: { type: number, whenChanged: accept, storage: { kind: project-field, name: Mass } }\n";
function setup(initial: ProjectField[] = []) {
  const directory = mkdtempSync(join(tmpdir(), "project-config-"));
  const store = openStore({ path: join(directory, "store.sqlite") });
  store.connection.migrate("metadata", taskMetadataMigrationSteps);
  let fields = initial;
  let seq = 0;
  let observed = false;
  const writes: ProjectFieldWrite[] = [];
  const saves: SaveRequest[] = [];
  let saveMode: "accept" | "pending" | "already-pending" | "reject" = "accept";
  let failureAt: number | undefined;
  const source = {
    project: () => ({ nodeId: "P_one", owner: "sample", number: 1 }),
    projectByNumber: () => ({ nodeId: "P_one", owner: "sample", number: 1 }),
    moveCard: async () => {},
    projectFields: () => (observed ? { projectNodeId: "P_one", readAt: 10, fields } : undefined),
    observeProjectFields: async () => {
      observed = true;
      return { projectNodeId: "P_one", readAt: 10, fields };
    },
    writeProjectField: async (w: ProjectFieldWrite) => {
      if (writes.length === failureAt) throw new Error("Write interrupted");
      writes.push(w);
      if (w.kind === "create") {
        const f = {
          nodeId: `F_${++seq}`,
          name: w.name,
          type: w.type,
          options: (w.options ?? []).map((o) => ({ ...o, id: `O_${++seq}` })),
        };
        fields = [...fields, f];
        return f;
      }
      if (w.kind === "delete") {
        fields = fields.filter((f) => f.nodeId !== w.fieldNodeId);
        return;
      }
      fields = fields.map((f) =>
        f.nodeId === w.fieldNodeId
          ? {
              ...f,
              ...(w.name ? { name: w.name } : {}),
              ...(w.options
                ? { options: w.options.map((o) => ({ ...o, id: o.id ?? `O_${++seq}` })) }
                : {}),
            }
          : f,
      );
      return fields.find((f) => f.nodeId === w.fieldNodeId);
    },
  };
  const metadata = openTaskMetadata({
    connection: store.connection,
    actorOf: () => undefined,
    invocationOf: () => ({ actorId: "parcel", invokeId: "stage", entryId: "entry" }),
    source: async () => source,
    bindingOf: () => "parcels",
    bindings: () => [
      {
        binding: "parcels",
        owner: "sample",
        number: 1,
        environment: "local",
        portfolioItem: "shipments",
      },
    ],
    revisions: {
      save: async (request) => {
        saves.push(request);
        if (saveMode === "reject") throw new Error("Pull failed before save");
        if (saveMode === "already-pending")
          return { outcome: "already-saved", commit: "b".repeat(40), blueprints: undefined };
        if (saveMode === "pending")
          return { outcome: "saved", commit: "b".repeat(40), blueprints: undefined };
        await metadata.apply(
          memoryRevision("b".repeat(40), {
            "task-metadata.yml": request.files[0]!.text,
            "bindings.yml": bindings,
          }),
        );
        return { outcome: "already-saved", commit: "b".repeat(40), blueprints: undefined };
      },
    },
  });
  return {
    metadata,
    store,
    writes,
    saves,
    source,
    saveMode: (mode: typeof saveMode) => {
      saveMode = mode;
    },
    failAt: (n: number | undefined) => {
      failureAt = n;
    },
    change: (fn: (f: ProjectField[]) => ProjectField[]) => {
      fields = fn(fields);
    },
    close: async () => {
      await metadata.close();
      store.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
test("Apply serializes, converges, preserves option ids, and refuses a stale digest", async () => {
  const f = setup();
  try {
    await f.metadata.apply(
      memoryRevision("a".repeat(40), { "task-metadata.yml": text, "bindings.yml": bindings }),
    );
    const plan = await f.metadata.projects.plan("parcels");
    expect(plan.configuration.state).toBe("not-applied");
    const [first, second] = await Promise.all([
      f.metadata.projects.apply("parcels", { removeUndeclared: false }),
      f.metadata.projects.apply("parcels", { removeUndeclared: false }),
    ]);
    expect(first.writes).toBe(2);
    expect(second).toMatchObject({
      writes: 0,
      outcome: "in-sync",
      configuration: { state: "in-sync" },
    });
    f.change((fields) =>
      fields.map((field) =>
        field.name === "Stage"
          ? { ...field, options: field.options.map((o, i) => (i ? o : { ...o, name: "Ready" })) }
          : field,
      ),
    );
    expect(f.metadata.projects.list()[0]?.configuration).toEqual({ state: "drift", count: 1 });
    await expect(
      f.metadata.projects.apply("parcels", { removeUndeclared: false, digest: plan.digest }),
    ).rejects.toMatchObject({ status: 409, kind: "plan-stale" });
    const ids = f.source.projectFields()!.fields[0]!.options.map((o) => o.id);
    await f.metadata.projects.apply("parcels", { removeUndeclared: false });
    expect(f.source.projectFields()!.fields[0]!.options.map((o) => o.id)).toEqual(ids);
  } finally {
    await f.close();
  }
});
test("Accept saves one valid declaration and records only after it enters force", async () => {
  const f = setup();
  try {
    await f.metadata.apply(
      memoryRevision("a".repeat(40), { "task-metadata.yml": text, "bindings.yml": bindings }),
    );
    await f.metadata.projects.apply("parcels", { removeUndeclared: false });
    f.change((fields) =>
      fields.map((field) => (field.name === "Mass" ? { ...field, name: "Weight" } : field)),
    );
    const result = await f.metadata.projects.apply("parcels", { removeUndeclared: false });
    expect(result).toMatchObject({
      writes: 0,
      configuration: { state: "in-sync" },
      declarationCommit: "b".repeat(40),
    });
    expect(f.saves).toHaveLength(1);
    expect(f.saves[0]).toMatchObject({
      path: "task-metadata.yml",
      base: "a".repeat(40),
      text: expect.stringContaining("# keep this comment"),
    });
    expect(f.metadata.current()?.projects["parcels"]?.fields["mass"]?.storage?.name).toBe("Weight");
    expect((await f.metadata.projects.apply("parcels", { removeUndeclared: false })).writes).toBe(
      0,
    );
  } finally {
    await f.close();
  }
});
test("partial writes resume without duplicate fields; removeUndeclared gates every removal", async () => {
  const f = setup();
  try {
    await f.metadata.apply(
      memoryRevision("a".repeat(40), { "task-metadata.yml": text, "bindings.yml": bindings }),
    );
    f.failAt(1);
    await expect(
      f.metadata.projects.apply("parcels", { removeUndeclared: false }),
    ).rejects.toMatchObject({ status: 502, detail: { writes: 1 } });
    expect(
      f.store.connection.database
        .prepare("SELECT count(*) AS n FROM metadata_project_applies")
        .get()?.["n"],
    ).toBe(0);
    f.failAt(undefined);
    expect((await f.metadata.projects.apply("parcels", { removeUndeclared: false })).writes).toBe(
      1,
    );
    expect(f.source.projectFields()!.fields.map((f) => f.name)).toEqual(["Stage", "Mass"]);
    f.change((fields) => [
      ...fields,
      { nodeId: "F_note", name: "Note", type: "text", options: [] },
    ]);
    const kept = await f.metadata.projects.apply("parcels", { removeUndeclared: false });
    expect(kept.writes).toBe(0);
    expect(kept.changes).toMatchObject([{ outcome: "kept", requiresRemoval: true }]);
    expect((await f.metadata.projects.apply("parcels", { removeUndeclared: true })).writes).toBe(1);
    expect((await f.metadata.projects.apply("parcels", { removeUndeclared: true })).writes).toBe(0);
  } finally {
    await f.close();
  }
});
test("a pushed accept save remains drift and retries report its commit without saving twice", async () => {
  const f = setup();
  try {
    await f.metadata.apply(
      memoryRevision("a".repeat(40), { "task-metadata.yml": text, "bindings.yml": bindings }),
    );
    await f.metadata.projects.apply("parcels", { removeUndeclared: false });
    f.change((fields) =>
      fields.map((field) => (field.name === "Mass" ? { ...field, name: "Weight" } : field)),
    );
    f.saveMode("pending");
    await expect(
      f.metadata.projects.apply("parcels", { removeUndeclared: false }),
    ).rejects.toMatchObject({
      status: 409,
      kind: "declaration-pending",
      detail: { commit: "b".repeat(40) },
    });
    expect(f.metadata.projects.list()[0]?.configuration).toEqual({ state: "drift", count: 1 });
    expect(
      f.store.connection.database.prepare("SELECT commit_id FROM metadata_project_applies").get()?.[
        "commit_id"
      ],
    ).toBe("a".repeat(40));
    f.saveMode("reject");
    await expect(
      f.metadata.projects.apply("parcels", { removeUndeclared: false }),
    ).rejects.toMatchObject({ kind: "declaration-pending", detail: { commit: "b".repeat(40) } });
    expect(f.saves).toHaveLength(2);
    expect(f.saves[1]!.saveId).toBe(f.saves[0]!.saveId);
    await f.metadata.apply(
      memoryRevision("b".repeat(40), {
        "task-metadata.yml": f.saves[0]!.files[0]!.text,
        "bindings.yml": bindings,
      }),
    );
    expect(
      (await f.metadata.projects.apply("parcels", { removeUndeclared: false })).configuration,
    ).toEqual({ state: "in-sync" });
    expect(
      f.store.connection.database
        .prepare("SELECT count(*) AS n FROM metadata_pending_saves")
        .get()?.["n"],
    ).toBe(0);
  } finally {
    await f.close();
  }
});
test("an already-saved acceptance is pending until the declaration enters force", async () => {
  const f = setup();
  try {
    await f.metadata.apply(
      memoryRevision("a".repeat(40), { "task-metadata.yml": text, "bindings.yml": bindings }),
    );
    await f.metadata.projects.apply("parcels", { removeUndeclared: false });
    f.change((fields) =>
      fields.map((field) => (field.name === "Mass" ? { ...field, name: "Weight" } : field)),
    );
    f.saveMode("already-pending");
    await expect(
      f.metadata.projects.apply("parcels", { removeUndeclared: false }),
    ).rejects.toMatchObject({ status: 409, kind: "declaration-pending" });
    expect(f.metadata.projects.list()[0]?.lastApplied?.commit).toBe("a".repeat(40));
    expect((await f.metadata.projects.plan("parcels")).configuration).toEqual({
      state: "drift",
      count: 1,
    });
  } finally {
    await f.close();
  }
});
test("unrepresentable observations revert; invalid accepted names never save or write", async () => {
  const f = setup();
  try {
    await f.metadata.apply(
      memoryRevision("a".repeat(40), { "task-metadata.yml": text, "bindings.yml": bindings }),
    );
    await f.metadata.projects.apply("parcels", { removeUndeclared: false });
    f.change((fields) =>
      fields.map((field) =>
        field.name === "Mass" ? { ...field, nodeId: "F_iteration", type: "iteration" } : field,
      ),
    );
    expect((await f.metadata.projects.plan("parcels")).configuration).toEqual({
      state: "drift",
      count: 2,
    });
    expect(
      (await f.metadata.projects.apply("parcels", { removeUndeclared: true })).configuration,
    ).toEqual({ state: "in-sync" });
    expect(f.saves).toHaveLength(0);
  } finally {
    await f.close();
  }
});
test("complete-document lint rejects two accepted fields stored under one name before any write", async () => {
  const f = setup();
  try {
    const two =
      text +
      "      box: { type: text, whenChanged: accept, storage: { kind: project-field, name: Box } }\n";
    await f.metadata.apply(
      memoryRevision("a".repeat(40), { "task-metadata.yml": two, "bindings.yml": bindings }),
    );
    await f.metadata.projects.apply("parcels", { removeUndeclared: false });
    f.change((fields) =>
      fields.map((field) =>
        field.name === "Mass" || field.name === "Box" ? { ...field, name: "Weight" } : field,
      ),
    );
    const count = f.writes.length;
    await expect(
      f.metadata.projects.apply("parcels", { removeUndeclared: false }),
    ).rejects.toMatchObject({ status: 409, kind: "declaration-invalid" });
    expect(f.writes).toHaveLength(count);
    expect(f.saves).toHaveLength(0);
    expect(f.metadata.projects.list()[0]?.configuration).toEqual({ state: "drift", count: 2 });
    expect(
      f.store.connection.database.prepare("SELECT commit_id FROM metadata_project_applies").get()?.[
        "commit_id"
      ],
    ).toBe("a".repeat(40));
  } finally {
    await f.close();
  }
});
test("a declaration-only revision changes the acceptance save base to the revision in force", async () => {
  const f = setup();
  try {
    await f.metadata.apply(
      memoryRevision("a".repeat(40), { "task-metadata.yml": text, "bindings.yml": bindings }),
    );
    await f.metadata.projects.apply("parcels", { removeUndeclared: false });
    await f.metadata.apply(
      memoryRevision("c".repeat(40), {
        "task-metadata.yml": text + "# a comment change\n",
        "bindings.yml": bindings,
      }),
    );
    f.change((fields) =>
      fields.map((field) => (field.name === "Mass" ? { ...field, name: "Weight" } : field)),
    );
    await f.metadata.projects.apply("parcels", { removeUndeclared: false });
    expect(f.saves[0]).toMatchObject({
      base: "c".repeat(40),
      text: expect.stringContaining("# a comment change"),
    });
  } finally {
    await f.close();
  }
});
test("historical lifecycle-only declarations reopen with empty task fields", async () => {
  const f = setup();
  try {
    f.store.connection.database
      .prepare(
        "INSERT INTO metadata_declarations (commit_id, declaration, accepted_at) VALUES (?, ?, ?)",
      )
      .run(
        "a".repeat(40),
        JSON.stringify({
          projects: { parcels: { lifecycle: { field: "Stage", options: ["Packed"] } } },
        }),
        10,
      );
    const reopened = openTaskMetadata({
      connection: f.store.connection,
      actorOf: () => undefined,
      invocationOf: () => ({ actorId: "parcel", invokeId: "stage", entryId: "entry" }),
      source: async () => f.source,
      bindingOf: () => "parcels",
    });
    expect(reopened.current()?.projects["parcels"]?.fields).toEqual({});
    await reopened.close();
  } finally {
    await f.close();
  }
});
test("accept after restart reads the persisted clean revision even when the current revision is rejected", async () => {
  const f = setup();
  let reopened: ReturnType<typeof openTaskMetadata> | undefined;
  try {
    const clean = memoryRevision("a".repeat(40), {
      "task-metadata.yml": text,
      "bindings.yml": bindings,
    });
    await f.metadata.apply(clean);
    await f.metadata.projects.apply("parcels", { removeUndeclared: false });
    f.change((fields) =>
      fields.map((field) => (field.name === "Mass" ? { ...field, name: "Weight" } : field)),
    );
    reopened = openTaskMetadata({
      connection: f.store.connection,
      actorOf: () => undefined,
      invocationOf: () => ({ actorId: "parcel", invokeId: "stage", entryId: "entry" }),
      source: async () => f.source,
      bindingOf: () => "parcels",
      bindings: () => [
        {
          binding: "parcels",
          owner: "sample",
          number: 1,
          environment: "local",
          portfolioItem: "shipments",
        },
      ],
      revisionAt: async (commit) => {
        expect(commit).toBe(clean.commit);
        return clean;
      },
      revisions: {
        save: async (request) => {
          expect(request.base).toBe(clean.commit);
          expect(request.files[0]!.text).toContain("# keep this comment");
          await reopened!.apply(
            memoryRevision("b".repeat(40), {
              "task-metadata.yml": request.files[0]!.text,
              "bindings.yml": bindings,
            }),
          );
          return { outcome: "already-saved", commit: "b".repeat(40), blueprints: undefined };
        },
      },
    });
    await reopened.apply(
      memoryRevision("c".repeat(40), {
        "task-metadata.yml": "projects: []",
        "bindings.yml": bindings,
      }),
    );
    expect(
      (await reopened.projects.apply("parcels", { removeUndeclared: false })).configuration,
    ).toEqual({ state: "in-sync" });
  } finally {
    await reopened?.close();
    await f.close();
  }
});
test("accept options by id: renamed owned colors stay owned and added options do not gain color ownership", async () => {
  const f = setup();
  try {
    const choices =
      text +
      "      route:\n        type: single-select\n        whenChanged: accept\n        options: [{ name: Air, color: red }, Road]\n";
    await f.metadata.apply(
      memoryRevision("a".repeat(40), { "task-metadata.yml": choices, "bindings.yml": bindings }),
    );
    await f.metadata.projects.apply("parcels", { removeUndeclared: false });
    f.change((fields) =>
      fields.map((field) =>
        field.name === "route"
          ? {
              ...field,
              options: [
                { id: "O_added", name: "Rail", color: "purple", description: "New" },
                { ...field.options[0]!, name: "Sky", color: "green" },
                { ...field.options[1]!, color: "yellow" },
              ],
            }
          : field,
      ),
    );
    await f.metadata.projects.apply("parcels", { removeUndeclared: false });
    const accepted = f.metadata.current()?.projects["parcels"]?.fields["route"];
    expect(accepted).toMatchObject({
      options: [{ name: "Rail" }, { name: "Sky", color: "green" }, { name: "Road" }],
    });
    if (accepted?.type !== "single-select") throw new Error("Expected a single-select field");
    expect(accepted.options[0]).not.toHaveProperty("color");
    expect(accepted.options[2]).not.toHaveProperty("color");
    expect((await f.metadata.projects.apply("parcels", { removeUndeclared: false })).writes).toBe(
      0,
    );
  } finally {
    await f.close();
  }
});
