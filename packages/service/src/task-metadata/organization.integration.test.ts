// ---
// relationships:
//   verifies: [task-metadata, github-event-source, projects-api]
// ---
import { expect, test } from "vite-plus/test";
import {
  organizationHost,
  organizationBindings,
  organizationMetadata,
} from "./test-fixtures/organization-host.ts";
import { memoryRevision } from "@wyrd-company/manifold-shared";
import { stringify } from "yaml";
const scope = { kind: "organization" as const, organization: "sample" };
test("two Projects apply the organization union once, write observed values, preserve option ids and restart in sync", async () => {
  const f = await organizationHost();
  try {
    const plan = await f.service.taskMetadata.projects.plan("first");
    expect(plan.scopes).toMatchObject([
      { status: "ready", scope: { bindings: ["first", "second"] } },
    ]);
    expect(
      await f.service.taskMetadata.projects.apply("first", {
        digest: plan.digest,
        removeUndeclared: false,
      }),
    ).toMatchObject({ writes: 3 });
    expect(f.api.fields).toHaveLength(1);
    expect(f.api.types).toHaveLength(2);
    expect(
      await f.service.taskMetadata.projects.apply("second", { removeUndeclared: false }),
    ).toMatchObject({ writes: 0 });
    const write = {
      actorId: "actor",
      invokeId: "set",
      entryId: "entry",
      issueNodeId: "I_A",
      projectNodeId: "P_one",
      field: "priority",
      storage: { kind: "issue-field" as const, organization: "sample", name: "Urgency" },
      labels: [],
      repositories: [],
      value: "High",
    };
    await f.service.github.writeTaskField(write);
    await f.service.github.writeTaskField({
      ...write,
      field: "category",
      invokeId: "type",
      storage: { kind: "issue-type", organization: "sample" },
      value: "request",
    });
    await expect
      .poll(
        () =>
          f.service.taskMetadata.values("first", f.service.github.trackedIssue("I_A")!)?.[
            "priority"
          ],
      )
      .toEqual({ state: "set", value: "High" });
    expect(
      f.service.taskMetadata.values("first", f.service.github.trackedIssue("I_A")!)?.["category"],
    ).toEqual({ state: "set", value: "Request" });
    const ids = f.api.fields[0]!.options.map((o) => o.id);
    f.api.fields[0]!.options[1]!.name = "Elevated";
    await f.service.github.observeScope(scope);
    expect((await f.service.taskMetadata.projects.plan("second")).configuration).toMatchObject({
      state: "drift",
    });
    await f.service.taskMetadata.projects.apply("second", { removeUndeclared: false });
    expect(f.api.fields[0]!.options.map((o) => o.id)).toEqual(ids);
    expect(f.api.fields[0]!.options.map((o) => o.name)).toEqual(["Normal", "High"]);
    expect(f.api.log.find((row) => row.operation === "RESTIssueFieldUpdate")?.input).toMatchObject({
      options: [
        { id: expect.any(Number), name: "Normal" },
        { id: expect.any(Number), name: "High" },
      ],
    });
    await f.restart();
    expect(
      await f.service.taskMetadata.projects.apply("first", { removeUndeclared: false }),
    ).toMatchObject({ writes: 0 });
    expect(
      f.service.store.connection.database
        .prepare("SELECT count(*) n FROM metadata_scope_applies")
        .get()?.["n"],
    ).toBe(1);
  } finally {
    await f.close();
  }
});
test("scope refusal and shared-conflict prevent all writes; transport keeps the last mirror observation", async () => {
  const f = await organizationHost();
  try {
    f.api.owner("User");
    await expect(
      f.service.taskMetadata.projects.apply("first", { removeUndeclared: false }),
    ).rejects.toMatchObject({ kind: "scope-unavailable", status: 409 });
    expect(f.api.fields).toEqual([]);
    f.api.owner("Organization");
    await f.service.github.observeScope(scope);
    const before = f.service.github.scopeConfiguration(scope);
    f.api.fail("GitHubOrganizationFields", 503);
    await expect(f.service.github.observeScope(scope)).rejects.toMatchObject({ kind: "transport" });
    expect(f.service.github.scopeConfiguration(scope)).toEqual(before);
    f.api.clearFailure();
    const declaration = organizationMetadata();
    declaration.projects["second"]!.fields["priority"].options = ["Different"];
    const result = await f.service.taskMetadata.apply(
      memoryRevision("b".repeat(40), {
        "bindings.yml": stringify(organizationBindings),
        "task-metadata.yml": stringify(declaration),
      }),
    );
    expect(result).toMatchObject({ status: "rejected", findings: [{ kind: "shared-conflict" }] });
    expect(f.api.fields).toEqual([]);
  } finally {
    await f.close();
  }
});
test("partial organization Apply restarts from external state without duplicate entities", async () => {
  const f = await organizationHost();
  try {
    f.api.fail("GitHubOrganizationWrite", 500);
    await expect(
      f.service.taskMetadata.projects.apply("first", { removeUndeclared: false }),
    ).rejects.toMatchObject({ status: 502 });
    f.api.clearFailure();
    await f.service.github.writeScopeEntity({
      kind: "issue-field-create",
      organization: "sample",
      name: "Urgency",
      type: "single-select",
      options: [
        { name: "Normal", color: "gray", description: "" },
        { name: "High", color: "gray", description: "" },
      ],
    });
    expect(
      f.service.store.connection.database
        .prepare("SELECT count(*) n FROM metadata_scope_applies")
        .get()?.["n"],
    ).toBe(0);
    const id = f.api.fields[0]!.id;
    await f.restart();
    expect(
      await f.service.taskMetadata.projects.apply("first", { removeUndeclared: false }),
    ).toMatchObject({ writes: 2 });
    expect(f.api.fields.map((f) => f.id)).toEqual([id]);
    expect(
      await f.service.taskMetadata.projects.apply("second", { removeUndeclared: false }),
    ).toMatchObject({ writes: 0 });
  } finally {
    await f.close();
  }
});

test("Accept organization drift saves every binding and repeated Apply writes nothing", async () => {
  const f = await organizationHost(true);
  try {
    await f.service.taskMetadata.projects.apply("first", { removeUndeclared: false });
    f.api.fields[0]!.name = "Importance";
    f.api.types[0]!.name = "Inquiry";
    await f.service.github.observeScope(scope);
    const plan = await f.service.taskMetadata.projects.plan("first");
    expect(plan.changes.filter((c) => c.side === "declaration")).toHaveLength(2);
    await f.service.taskMetadata.projects.apply("first", { removeUndeclared: false });
    await expect
      .poll(() => f.service.taskMetadata.current()?.projects["second"]?.fields["priority"]?.storage)
      .toMatchObject({ name: "Importance" });
    expect(f.service.taskMetadata.current()?.projects["second"]?.fields["category"]).toMatchObject({
      options: [{ name: "Inquiry" }, { name: "Return" }],
    });
    expect(
      await f.service.taskMetadata.projects.apply("second", { removeUndeclared: false }),
    ).toMatchObject({ writes: 0 });
  } finally {
    await f.close();
  }
});
test("undeclared organization items remain; owned option removal needs explicit consent", async () => {
  const f = await organizationHost();
  try {
    await f.service.taskMetadata.projects.apply("first", { removeUndeclared: false });
    await f.service.github.writeScopeEntity({
      kind: "issue-field-create",
      organization: "sample",
      name: "Unowned",
      type: "text",
    });
    await f.service.github.writeScopeEntity({
      kind: "issue-type-create",
      organization: "sample",
      name: "Unowned",
      color: "gray",
      description: "",
    });
    f.api.fields[0]!.options.push({
      id: "O_extra",
      fullDatabaseId: 999,
      name: "Extra",
      color: "GREEN",
      description: "",
      priority: 2,
    });
    await f.service.github.observeScope(scope);
    await f.service.taskMetadata.projects.apply("first", { removeUndeclared: false });
    expect(f.api.fields[0]!.options).toHaveLength(3);
    await f.service.taskMetadata.projects.apply("first", { removeUndeclared: true });
    expect(f.api.fields[0]!.options).toHaveLength(2);
    expect(f.api.fields.map((f) => f.name)).toContain("Unowned");
    expect(f.api.types.map((t) => t.name)).toContain("Unowned");
  } finally {
    await f.close();
  }
});

test("SIGKILL after an external organization create resumes Apply without duplicates", async () => {
  const { fork } = await import("node:child_process");
  const { join } = await import("node:path");
  const { childArtifacts } = await import("../../../../test-support/child-process.ts");
  const { childProcessLimit } = await import("../../../../test-support/limits.ts");
  const { serviceFixture } = await import("../service/test-fixtures/repository.ts");
  const { organizationFake } = await import("../github-source/test-fixtures/organization-api.ts");
  const { writeFile } = await import("node:fs/promises");
  const { DatabaseSync } = await import("node:sqlite");
  const repository = await serviceFixture();
  const api = await organizationFake(repository.api);
  await repository.commit(60, {
    bindings: organizationBindings,
    taskMetadata: organizationMetadata(),
  });
  await writeFile(
    repository.file,
    stringify({
      ...repository.configuration,
      github: { ...repository.configuration.github, apiUrl: api.url },
    }),
  );
  const children: ReturnType<typeof fork>[] = [];
  const worker = () => {
    const child = fork(
      join(childArtifacts().service, "task-metadata/test-fixtures/project-config-worker.js"),
      [repository.file, "resume"],
      { silent: true, execArgv: [] },
    );
    children.push(child);
    let address: string | undefined;
    let stderr = "";
    child.on("message", (m: { address: string }) => {
      address = m.address;
    });
    child.stderr!.on("data", (c) => {
      stderr += String(c);
    });
    const exited = new Promise<{ code: number | null; signal: string | null }>((r) =>
      child.once("exit", (code, signal) => r({ code, signal })),
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
  };
  const apply = async (address: string) => {
    const response = await fetch(address + "/api/projects/first/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"removeUndeclared":false}',
    });
    return response.json();
  };
  let release: (() => void) | undefined;
  try {
    const first = worker();
    const address = await first.ready();
    await expect
      .poll(
        async () => {
          const r = await fetch(address + "/api/projects");
          return (await r.json()).projects[0]?.projectNodeId;
        },
        { timeout: childProcessLimit },
      )
      .toBe("P_one");
    const held = api.holdWrite();
    release = held.release;
    const lost = apply(address).catch(() => undefined);
    await held.reached;
    expect(api.fields).toHaveLength(1);
    const id = api.fields[0]!.id;
    first.child.kill("SIGKILL");
    expect(await first.exited).toEqual({ code: null, signal: "SIGKILL" });
    await lost;
    held.release();
    const db = new DatabaseSync(join(repository.directory, "data/state.sqlite"));
    expect(db.prepare("SELECT count(*) n FROM metadata_scope_applies").get()?.["n"]).toBe(0);
    db.close();
    const second = worker();
    const next = await second.ready();
    await expect
      .poll(
        async () => {
          const r = await fetch(next + "/api/projects");
          return (await r.json()).projects[0]?.projectNodeId;
        },
        { timeout: childProcessLimit },
      )
      .toBe("P_one");
    expect(await apply(next)).toMatchObject({ writes: 2 });
    expect(api.fields.map((f) => f.id)).toEqual([id]);
    expect(await apply(next)).toMatchObject({ writes: 0 });
    second.child.send("stop");
    expect(await second.exited).toEqual({ code: 0, signal: null });
  } finally {
    release?.();
    await Promise.all(
      children.map(
        (child) =>
          new Promise<void>((r) => {
            if (child.exitCode !== null || child.signalCode !== null) return r();
            child.once("exit", () => r());
            child.kill("SIGKILL");
          }),
      ),
    );
    await api.close();
    await repository.close();
  }
});

test("organization observation reads all pages and preserves the mirror on pagination failure", async () => {
  const f = await organizationHost();
  try {
    await f.service.taskMetadata.projects.apply("first", { removeUndeclared: false });
    await f.service.github.writeScopeEntity({
      kind: "issue-field-create",
      organization: "sample",
      name: "Other",
      type: "text",
    });
    f.api.paginate(1);
    const read = await f.service.github.observeScope(scope);
    expect(read).toMatchObject({
      status: "ready",
      issueFields: [{ name: "Urgency" }, { name: "Other" }],
      issueTypes: [{ name: "Request" }, { name: "Return" }],
    });
    // The adapter must reject a repeated cursor before it can replace the durable observation.
    await f.service.github.writeScopeEntity({
      kind: "issue-field-create",
      organization: "sample",
      name: "Third",
      type: "number",
    });
    const before = f.service.github.scopeConfiguration(scope);
    f.api.paginate(1, true);
    await expect(f.service.github.observeScope(scope)).rejects.toMatchObject({ kind: "transport" });
    expect(f.service.github.scopeConfiguration(scope)).toEqual(before);
  } finally {
    await f.close();
  }
});
test.each([
  ["User", "unsupported"],
  ["Missing", "missing"],
])("organization %s refuses Apply without writes", async (owner, status) => {
  const f = await organizationHost();
  try {
    f.api.owner(owner);
    expect(await f.service.github.observeScope(scope)).toMatchObject({ status });
    await expect(
      f.service.taskMetadata.projects.apply("first", { removeUndeclared: false }),
    ).rejects.toMatchObject({ kind: "scope-unavailable" });
    expect(f.api.log.filter((row) => row.operation === "GitHubOrganizationWrite")).toEqual([]);
  } finally {
    await f.close();
  }
});
test("forbidden scope refuses Apply and organization task-field failures send no mutations", async () => {
  const f = await organizationHost();
  try {
    f.api.fail("GitHubOrganizationFields", 403);
    expect(await f.service.github.observeScope(scope)).toMatchObject({ status: "forbidden" });
    await expect(
      f.service.taskMetadata.projects.apply("first", { removeUndeclared: false }),
    ).rejects.toMatchObject({ kind: "scope-unavailable" });
    f.api.clearFailure();
    await f.service.taskMetadata.projects.apply("first", { removeUndeclared: false });
    const write = {
      actorId: "actor",
      invokeId: "set",
      entryId: "entry",
      issueNodeId: "I_A",
      projectNodeId: "P_one",
      field: "priority",
      storage: { kind: "issue-field" as const, organization: "sample", name: "Absent" },
      labels: [],
      repositories: [],
      value: "Normal",
    };
    await expect(f.service.github.writeTaskField(write)).rejects.toMatchObject({ kind: "missing" });
    await expect(
      f.service.github.writeTaskField({
        ...write,
        entryId: "option",
        storage: { ...write.storage, name: "Urgency" },
        value: "Absent",
      }),
    ).rejects.toMatchObject({ kind: "missing" });
    await expect(
      f.service.github.writeTaskField({
        ...write,
        entryId: "outside",
        storage: { ...write.storage, organization: "other" },
      }),
    ).rejects.toMatchObject({ kind: "out-of-scope" });
    expect(f.api.log.filter((row) => row.operation === "GitHubOrganizationValue")).toEqual([]);
  } finally {
    await f.close();
  }
});

test("user-owned Projects can own organization repository fields with an explicit organization", async () => {
  const f = await organizationHost(false, true);
  try {
    expect(
      await f.service.taskMetadata.projects.apply("first", { removeUndeclared: false }),
    ).toMatchObject({ writes: 3 });
    const issue = f.service.github.trackedIssue("I_A")!;
    expect(issue.projects[0]?.owner).toBe("visitor");
    await f.service.github.writeTaskField({
      actorId: "actor",
      invokeId: "set",
      entryId: "entry",
      projectNodeId: "P_one",
      issueNodeId: "I_A",
      field: "priority",
      storage: { kind: "issue-field", organization: "sample", name: "Urgency" },
      labels: [],
      repositories: [],
      value: "Normal",
    });
    await expect
      .poll(
        () =>
          f.service.taskMetadata.values("first", f.service.github.trackedIssue("I_A")!)?.[
            "priority"
          ],
      )
      .toEqual({ state: "set", value: "Normal" });
  } finally {
    await f.close();
  }
});
test("user-owned Project defaults to its user owner and refuses the entire Apply", async () => {
  const f = await organizationHost(false, true, false);
  try {
    await expect(
      f.service.taskMetadata.projects.apply("first", { removeUndeclared: false }),
    ).rejects.toMatchObject({ kind: "scope-unavailable" });
    expect(f.api.fields).toEqual([]);
    expect(f.api.types).toEqual([]);
  } finally {
    await f.close();
  }
});

test("an unavailable organization mirror refuses task writes before a request", async () => {
  const f = await organizationHost();
  try {
    await f.service.taskMetadata.projects.apply("first", { removeUndeclared: false });
    f.api.owner("User");
    await f.service.github.observeScope(scope);
    f.api.log.length = 0;
    await expect(
      f.service.github.writeTaskField({
        actorId: "actor",
        invokeId: "set",
        entryId: "entry",
        projectNodeId: "P_one",
        issueNodeId: "I_A",
        field: "priority",
        storage: { kind: "issue-field", organization: "sample", name: "Urgency" },
        labels: [],
        repositories: [],
        value: "Normal",
      }),
    ).rejects.toMatchObject({ kind: "unavailable" });
    expect(
      f.api.log.filter(
        (row) =>
          row.operation === "GitHubOrganizationFields" ||
          row.operation === "GitHubOrganizationValue",
      ),
    ).toEqual([]);
  } finally {
    await f.close();
  }
});
