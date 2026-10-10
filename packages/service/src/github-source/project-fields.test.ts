// ---
// relationships:
//   verifies: [github-event-source, task-metadata]
// ---
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, test } from "vite-plus/test";
import { openStore } from "../store/index.ts";
import { startRouter } from "../router/index.ts";
import { SecretValue } from "../service-configuration/index.ts";
import { startGitHubSource } from "./index.ts";
import type { ProjectFieldWrite } from "./index.ts";
import { githubFake, FakeClock } from "./test-fixtures/api.ts";
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).toReversed()) await cleanup();
});
const move = {
  actorId: "parcel",
  invokeId: "stage",
  entryId: "entry",
  projectNodeId: "P_one",
  issueNodeId: "I_A",
  field: "Stage",
  option: "Packed",
};
async function setup(identity?: string) {
  const clock = new FakeClock();
  const fake = await githubFake();
  cleanups.push(fake.close);
  const projectId = "P_one",
    owner = identity ?? "sample",
    issueId = "I_A",
    field = identity ?? "Stage";
  fake.project.id = projectId;
  fake.project.owner.login = identity ?? owner;
  if (identity !== undefined) {
    fake.issues.set(issueId, {
      ...fake.issues.get("I_A")!,
      id: issueId,
      repository: { nameWithOwner: `${owner}/records` },
      title: identity,
    });
    fake.fields[0]!.name = field;
  }
  fake.addItem("IT_A", issueId);
  fake.items.get("IT_A")!.fieldValues.nodes = [
    {
      field: { id: "F_stage", name: field, dataType: "SINGLE_SELECT" },
      optionId: "O_sorting",
      name: "Sorting",
    },
  ];
  const directory = mkdtempSync(join(tmpdir(), "project-fields-"));
  const store = openStore({ path: join(directory, "store.sqlite") });
  store.saveSnapshot({
    actorId: "parcel",
    machine: "record",
    snapshot: { status: "active", value: "waiting" },
  });
  const router = startRouter({
    store,
    host: {
      subscription: () => ({ topics: ["github"] }),
      restore: () => ({ status: "held", reason: "test" }),
    },
  });
  const secretFile = join(directory, "hook.secret");
  writeFileSync(secretFile, "synthetic-secret");
  const writes: ProjectFieldWrite[] = [];
  let lifecycle = field;
  const options = {
    store,
    router,
    clock,
    configuration: {
      apiUrl: fake.url,
      owners: { [owner]: { credential: "example", hooks: [] } },
      sweepIntervalMs: 900000,
      redeliveryIntervalMs: 60000,
      requestTimeoutMs: 100,
    },
    credentials: {
      names: ["example"],
      resolve: () => ({
        kind: "github-app" as const,
        name: "example",
        installationToken: async () => new SecretValue("example", "synthetic-token"),
      }),
    },
    boundProjects: () => [{ owner, number: 1 }],
    processRepository: {
      url: "https://example.test/sample/process.git",
      branch: "main",
      pull: async () => ({ kind: "unchanged" as const, commit: "a".repeat(40) }),
    },
    probeFieldWrite: (write: ProjectFieldWrite) => writes.push(write),
    lifecycleField: (id: string) => (id === projectId ? lifecycle : undefined),
  };
  let source = startGitHubSource(options);
  cleanups.push(async () => {
    await source.stop();
    router.stop();
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
  await expect.poll(() => source.trackedIssue(issueId)?.items.length).toBe(1);
  const fieldEvents = () =>
    store.connection.database
      .prepare(
        "SELECT payload FROM store_inbox WHERE payload LIKE '%github.project-item.field-changed%' ORDER BY sequence",
      )
      .all()
      .map((row) => JSON.parse(row["payload"] as string));
  return {
    options,
    directory,
    fake,
    get source() {
      return source;
    },
    store,
    clock,
    writes,
    fieldEvents,
    setLifecycle(name: string) {
      lifecycle = name;
    },
    async restart() {
      await source.stop();
      source = startGitHubSource(options);
    },
  };
}
test("a sweep writes the Project's fields, in order, leaving out issue fields, and publishes no field change", async () => {
  const { source, fieldEvents } = await setup();
  const fields = source.projectFields("P_one");
  expect(fields?.projectNodeId).toBe("P_one");
  expect(fields?.readAt).toBeGreaterThan(0);
  expect(fields?.fields).toEqual([
    {
      nodeId: "F_stage",
      name: "Stage",
      type: "single-select",
      options: [
        { id: "O_sorting", name: "Sorting", color: "gray", description: "" },
        { id: "O_packed", name: "Packed", color: "blue", description: "" },
        { id: "O_shipped", name: "Shipped", color: "green", description: "" },
      ],
    },
  ]);
  expect(fieldEvents()).toEqual([]);
});
test("projectFields is undefined before a read, and observeProjectFields reads on demand", async () => {
  const { source, fake } = await setup();
  fake.fields.push({
    id: "F_priority",
    name: "Priority",
    dataType: "SINGLE_SELECT",
    isIssueField: false,
    options: [{ id: "O_high", name: "High", color: "RED", description: "urgent" }],
  });
  const fields = await source.observeProjectFields("P_one");
  expect(fields.fields.map((f) => f.name)).toEqual(["Stage", "Priority"]);
  expect(fields.fields[1]!.options).toEqual([
    { id: "O_high", name: "High", color: "red", description: "urgent" },
  ]);
});
test("create answers with the field GitHub holds and updates the mirror", async () => {
  const { source, writes } = await setup();
  const write: ProjectFieldWrite = {
    kind: "create",
    projectNodeId: "P_one",
    name: "Priority",
    type: "single-select",
    options: [{ name: "High", color: "red", description: "urgent" }],
  };
  const field = await source.writeProjectField(write);
  expect(field).toMatchObject({
    name: "Priority",
    type: "single-select",
    options: [{ name: "High", color: "red", description: "urgent" }],
  });
  expect(field!.options[0]!.id).toMatch(/^O_/);
  expect(writes).toEqual([write]);
  expect(source.projectFields("P_one")?.fields.map((f) => f.name)).toContain("Priority");
});
test("an update that renames an option by its id keeps the item value and publishes no change", async () => {
  const { source, fieldEvents } = await setup();
  const field = await source.writeProjectField({
    kind: "update",
    projectNodeId: "P_one",
    fieldNodeId: "F_stage",
    options: [
      { id: "O_sorting", name: "Backlog", color: "gray", description: "" },
      { id: "O_packed", name: "Packed", color: "blue", description: "" },
      { id: "O_shipped", name: "Shipped", color: "green", description: "" },
    ],
  });
  expect(field!.options[0]).toMatchObject({ id: "O_sorting", name: "Backlog" });
  source.requestSweep();
  await new Promise((resolve) => setImmediate(resolve));
  await expect
    .poll(() => source.projectFields("P_one")?.fields[0]?.options[0]?.name)
    .toBe("Backlog");
  expect(fieldEvents()).toEqual([]);
});
test("a delete removes the field from the mirror and resolves undefined", async () => {
  const { source } = await setup();
  const created = await source.writeProjectField({
    kind: "create",
    projectNodeId: "P_one",
    name: "Priority",
    type: "text",
  });
  expect(source.projectFields("P_one")?.fields.map((f) => f.name)).toContain("Priority");
  const result = await source.writeProjectField({
    kind: "delete",
    projectNodeId: "P_one",
    fieldNodeId: created!.nodeId,
  });
  expect(result).toBeUndefined();
  expect(source.projectFields("P_one")?.fields.map((f) => f.name)).not.toContain("Priority");
});
test("typed field-write failures leave the mirror as it was", async () => {
  const { source, fake, clock } = await setup();
  // An unfinished sweep can consume the one-shot HTTP refusal before the write.
  await expect
    .poll(() => [...clock.timers].map((timer) => timer.at - clock.now()).sort((a, b) => a - b))
    .toEqual([60000, 900000]);
  const before = source.projectFields("P_one");
  fake.fail(502);
  await expect(
    source.writeProjectField({ kind: "create", projectNodeId: "P_one", name: "X", type: "text" }),
  ).rejects.toMatchObject({ kind: "transport" });
  fake.failQuery("GitHubCreateProjectField", "FORBIDDEN");
  await expect(
    source.writeProjectField({ kind: "create", projectNodeId: "P_one", name: "Y", type: "text" }),
  ).rejects.toMatchObject({ kind: "forbidden" });
  expect(source.projectFields("P_one")).toEqual(before);
});
test("creating a second field of one name fails the repeat", async () => {
  const { source } = await setup();
  const write: ProjectFieldWrite = {
    kind: "create",
    projectNodeId: "P_one",
    name: "Priority",
    type: "text",
  };
  await source.writeProjectField(write);
  await expect(source.writeProjectField(write)).rejects.toMatchObject({ kind: "rejected" });
});
test("a field write queued while an observation is held waits until it commits", async () => {
  const { source, fake } = await setup();
  const held = fake.hold("GitHubProjectFields");
  source.requestSweep();
  await held.reached;
  const written = source.writeProjectField({
    kind: "create",
    projectNodeId: "P_one",
    name: "Priority",
    type: "text",
  });
  await new Promise((resolve) => setImmediate(resolve));
  expect(fake.log.some((row) => row.operation === "GitHubCreateProjectField")).toBe(false);
  held.release();
  await written;
  expect(source.projectFields("P_one")?.fields.map((f) => f.name)).toContain("Priority");
});
test("lifecycle is true only for the field the declaration names, and false after a rename", async () => {
  const { source, fake, fieldEvents, setLifecycle } = await setup();
  await source.moveCard(move);
  await expect.poll(() => fieldEvents().length).toBe(1);
  expect(fieldEvents()[0]).toMatchObject({ field: { name: "Stage" }, lifecycle: true });
  // A non-lifecycle field's change is not a lifecycle change.
  fake.fields[0]!.name = "Phase";
  setLifecycle("Phase");
  fake.items.get("IT_A")!.fieldValues.nodes[0]!["optionId"] = "O_shipped";
  fake.items.get("IT_A")!.fieldValues.nodes[0]!["name"] = "Shipped";
  fake.items.get("IT_A")!.fieldValues.nodes[0]!["field"] = {
    id: "F_stage",
    name: "Phase",
    dataType: "SINGLE_SELECT",
  };
  source.requestSweep();
  await expect.poll(() => fieldEvents().length).toBe(2);
  expect(fieldEvents()[1]).toMatchObject({ field: { name: "Phase" }, lifecycle: true });
  // With the declaration still naming "Phase", a change to a differently named field is not lifecycle.
  setLifecycle("Stage");
  fake.items.get("IT_A")!.fieldValues.nodes[0]!["optionId"] = "O_packed";
  fake.items.get("IT_A")!.fieldValues.nodes[0]!["name"] = "Packed";
  source.requestSweep();
  await expect.poll(() => fieldEvents().length).toBe(3);
  expect(fieldEvents()[2]).toMatchObject({ lifecycle: false });
});
test("a stopped source throws from the field APIs", async () => {
  const { source } = await setup();
  await source.stop();
  expect(() => source.observeProjectFields("P_one")).toThrow(TypeError);
  expect(() =>
    source.writeProjectField({ kind: "create", projectNodeId: "P_one", name: "X", type: "text" }),
  ).toThrow(TypeError);
});
test("a move replayed after a restart recreates the option and attributes the new value", async () => {
  const f = await setup();
  f.fake.lagItem("IT_A");
  await f.source.moveCard(move);
  expect(
    f.store.connection.database.prepare("SELECT state FROM github_card_move").get(),
  ).toMatchObject({ state: "confirmed" });
  await f.restart();
  // A person deletes and recreates the option with the same name; GitHub clears the item's value.
  f.fake.fields[0]!.options[1] = {
    id: "O_packed2",
    name: "Packed",
    color: "blue",
    description: "",
  };
  f.fake.items.get("IT_A")!.fieldValues.nodes = [];
  f.fake.resumeItem("IT_A");
  // The sweep observes the clearing first.
  f.source.requestSweep();
  await expect.poll(() => f.fieldEvents().length).toBe(1);
  expect(f.fieldEvents()[0]).toMatchObject({ to: null, movedBy: null });
  // The restored invoke resolves the new option id and sets it.
  await f.source.moveCard(move);
  await expect.poll(() => f.fieldEvents().length).toBe(2);
  expect(f.fieldEvents()[1]).toMatchObject({
    to: { name: "Packed", optionId: "O_packed2" },
    movedBy: { actorId: "parcel", confirmed: true },
  });
});
test("a move replayed after a restart recreates the field and attributes the new value", async () => {
  const f = await setup();
  f.fake.lagItem("IT_A");
  await f.source.moveCard(move);
  await f.restart();
  // A person deletes and recreates the field with the same name; the item's value is cleared.
  f.fake.fields[0] = {
    id: "F_stage2",
    name: "Stage",
    dataType: "SINGLE_SELECT",
    isIssueField: false,
    options: [
      { id: "O_sorting2", name: "Sorting", color: "gray", description: "" },
      { id: "O_packed2", name: "Packed", color: "blue", description: "" },
      { id: "O_shipped2", name: "Shipped", color: "green", description: "" },
    ],
  };
  f.fake.items.get("IT_A")!.fieldValues.nodes = [];
  f.fake.resumeItem("IT_A");
  f.source.requestSweep();
  await expect.poll(() => f.fieldEvents().length).toBe(1);
  expect(f.fieldEvents()[0]).toMatchObject({ to: null, movedBy: null });
  await f.source.moveCard(move);
  await expect.poll(() => f.fieldEvents().length).toBe(2);
  expect(f.fieldEvents()[1]).toMatchObject({
    to: { name: "Packed", optionId: "O_packed2" },
    movedBy: { actorId: "parcel", confirmed: true },
  });
});
test("a refused replay resolving a new option preserves the earlier confirmed move independently", async () => {
  // Attribution evidence is keyed by resolved field and option ids: a refusal that resolves a
  // different option must delete only its own row, leaving the earlier confirmed move's row intact.
  const { fake, source, fieldEvents } = await setup();
  fake.lagItem("IT_A");
  await source.moveCard(move); // "Packed" -> O_packed; GitHub takes it; lagged, so not yet observed
  // A person renames the options so that the name "Packed" now resolves to O_shipped, while the
  // earlier move's option id O_packed survives under a new name.
  fake.fields[0]!.options = [
    { id: "O_sorting", name: "Sorting", color: "gray", description: "" },
    { id: "O_packed", name: "Archived", color: "blue", description: "" },
    { id: "O_shipped", name: "Packed", color: "green", description: "" },
  ];
  fake.failWrite("FORBIDDEN");
  await expect(source.moveCard(move)).rejects.toMatchObject({ kind: "forbidden" });
  // GitHub still holds the first move's value (O_packed); the lagged read now catches up.
  fake.resumeItem("IT_A");
  source.requestSweep();
  await expect.poll(() => fieldEvents().length).toBe(1);
  expect(fieldEvents()[0]).toMatchObject({
    to: { optionId: "O_packed" },
    movedBy: { actorId: "parcel", confirmed: true },
  });
});
test("a later success on a new option does not confirm an earlier uncertain attempt of the same invocation", async () => {
  // `confirmed` is keyed by resolved field and option ids: confirming the new option's row must not
  // flip a transport-uncertain row the same invocation left under a different option.
  const { fake, source, fieldEvents } = await setup();
  fake.lagItem("IT_A");
  fake.failWrite("TIMEOUT", 502); // transport: leaves a `sent` row for O_packed, fate unknown
  await expect(source.moveCard(move)).rejects.toMatchObject({ kind: "transport" });
  // A person renames options so the name "Packed" now resolves to O_shipped.
  fake.fields[0]!.options = [
    { id: "O_sorting", name: "Sorting", color: "gray", description: "" },
    { id: "O_packed", name: "Archived", color: "blue", description: "" },
    { id: "O_shipped", name: "Packed", color: "green", description: "" },
  ];
  await source.moveCard(move); // resolves O_shipped, succeeds -> confirms only the O_shipped row
  // The earlier transport write to O_packed turns out to have landed; the read catches up to it.
  fake.items.get("IT_A")!.fieldValues.nodes = [
    {
      field: { id: "F_stage", name: "Stage", dataType: "SINGLE_SELECT" },
      optionId: "O_packed",
      name: "Archived",
    },
  ];
  fake.resumeItem("IT_A");
  source.requestSweep();
  await expect.poll(() => fieldEvents().some((e) => e.to?.optionId === "O_packed")).toBe(true);
  expect(fieldEvents().find((e) => e.to?.optionId === "O_packed")).toMatchObject({
    movedBy: { actorId: "parcel", confirmed: false },
  });
});
test("stop rejects a queued field write with a transport error", async () => {
  const { source, fake } = await setup();
  const held = fake.hold("GitHubProjectFields");
  source.requestSweep(); // the runner enters a held field observation
  await held.reached;
  const written = source.writeProjectField({
    kind: "create",
    projectNodeId: "P_one",
    name: "Priority",
    type: "text",
  });
  const rejected = expect(written).rejects.toMatchObject({ kind: "transport" });
  const stopped = source.stop();
  held.release();
  await rejected;
  await stopped;
});

test.each(["inside\0tail", "\0leading"])(
  "GitHub mirror, fields, pending nodes and card move text restore: %j",
  async (text) => {
    const f = await setup(text);
    expect(f.source.trackedIssue("I_A")).toMatchObject({
      issue: { nodeId: "I_A" },
      projects: [{ nodeId: "P_one", owner: text }],
    });
    expect(f.source.projectFields("P_one")?.fields[0]?.name).toBe(text);
    await f.source.moveCard({
      ...move,
      actorId: text,
      invokeId: text,
      entryId: text,
      issueNodeId: "I_A",
      projectNodeId: "P_one",
      field: text,
    });
    await expect.poll(() => f.fieldEvents().length).toBe(1);
    expect(f.fieldEvents()[0]).toMatchObject({ movedBy: { actorId: text, confirmed: true } });
    await f.source.stop();
    const store = openStore({ path: join(f.directory, "store.sqlite") });
    const source = startGitHubSource({ ...f.options, store });
    cleanups.push(async () => {
      await source.stop();
      store.close();
    });
    await expect.poll(() => source.trackedIssue("I_A")?.items.length).toBe(1);
    expect(source.projectFields("P_one")?.fields[0]?.name).toBe(text);
    expect(source.trackedIssue("I_A")?.projects[0]?.owner).toBe(text);
  },
);
