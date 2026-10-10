// ---
// relationships:
//   verifies: task-metadata
// ---
import { expect, it } from "vite-plus/test";
import { taskFieldWrite } from "./task-field-set.ts";
const declaration = {
  projects: {
    Board: {
      lifecycle: { field: "Status", options: ["Open"] },
      repositories: ["example/repository"],
      fields: {
        Urgency: {
          type: "single-select" as const,
          storage: { kind: "label" as const, prefix: "urgency:" },
          whenChanged: "accept" as const,
          options: [{ name: "Normal" }, { name: "Urgent" }],
        },
      },
    },
  },
};
const invocation = { actorId: "actor", invokeId: "write", entryId: "entry" };
const identity = { project: "project", issue: "issue" };
it("writes the declaration's storage and scope and validates each value", () => {
  expect(taskFieldWrite(invocation, identity, "Board", declaration, "Urgency", "Urgent")).toEqual({
    ...invocation,
    projectNodeId: "project",
    issueNodeId: "issue",
    field: "Urgency",
    storage: { kind: "label", prefix: "urgency:" },
    labels: ["urgency:Normal", "urgency:Urgent"],
    repositories: ["example/repository"],
    value: "Urgent",
  });
  expect(
    taskFieldWrite(invocation, identity, "Board", declaration, "Urgency", null).value,
  ).toBeNull();
  expect(() =>
    taskFieldWrite(invocation, identity, "Board", declaration, "Urgency", "Unknown"),
  ).toThrowError(
    expect.objectContaining({ type: "task-field-set", kind: "value", field: "Urgency" }),
  );
  expect(() =>
    taskFieldWrite(invocation, identity, "Board", declaration, "Status", "Open"),
  ).toThrowError(expect.objectContaining({ kind: "undeclared" }));
});
it("the promise validates the boundary, awaits the source write and translates source errors", async () => {
  const { createActor, toPromise } = await import("xstate");
  const { metadataImplementations } = await import("./implementations.ts");
  const { openStore } = await import("../store/index.ts");
  const { GitHubWriteError } = await import("../github-source/index.ts");
  const store = openStore({ path: ":memory:" });
  const writes: unknown[] = [];
  let failure: InstanceType<typeof GitHubWriteError> | undefined;
  const registry = metadataImplementations(
    {
      connection: store.connection,
      actorOf: () => ({ manifold: identity, commit: "a".repeat(40) }),
      invocationOf: () => invocation,
      bindingOf: () => "Board",
      source: async () => ({
        project: () => ({ nodeId: "project", owner: "example", number: 1 }),
        moveCard: async () => {},
        writeTaskField: async (write) => {
          if (failure) throw failure;
          writes.push(write);
        },
      }),
    },
    () => declaration,
  );
  const run = (input: unknown) => {
    const actor = createActor(registry.actors["github-task-field-set"]!, { input });
    actor.start();
    return toPromise(actor);
  };
  try {
    await expect(run({ field: "Urgency", value: "Urgent" })).resolves.toEqual({});
    expect(writes).toHaveLength(1);
    await expect(run({ field: "Urgency", value: true })).rejects.toMatchObject({
      type: "task-field-set",
      kind: "input",
      field: "Urgency",
    });
    await expect(run({ field: "Missing", value: null })).rejects.toMatchObject({
      kind: "undeclared",
    });
    failure = new GitHubWriteError("body-conflict", "Issue body changed twice");
    await expect(run({ field: "Urgency", value: null })).rejects.toMatchObject({
      type: "task-field-set",
      kind: "body-conflict",
      field: "Urgency",
    });
  } finally {
    store.close();
  }
});
it("writes every storage from the approved declaration fixture", async () => {
  const { readFileSync } = await import("node:fs");
  const { parse } = await import("yaml");
  const { lintTaskMetadataDeclaration } = await import("@wyrd-company/manifold-shared");
  const fixtures = parse(
    readFileSync(
      new URL(
        "../../../../docs/specifications/task-metadata-declaration.fixtures.yml",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    bindings: Record<string, string>;
    declarations: { bindings: string; taskMetadata: string }[];
  };
  const fixture = fixtures.declarations[0]!;
  const result = lintTaskMetadataDeclaration({
    taskMetadata: fixture.taskMetadata,
    bindings: fixtures.bindings[fixture.bindings],
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Declaration fixture did not lint");
  for (const [field, declared] of Object.entries(result.declaration.projects["parcels"]!.fields)) {
    const value = declared.type === "single-select" ? declared.options[0]!.name : "2026-01-01";
    const write = taskFieldWrite(invocation, identity, "parcels", result.declaration, field, value);
    expect(write.storage).toEqual(declared.storage);
    expect(write.value).toEqual(value);
  }
});
