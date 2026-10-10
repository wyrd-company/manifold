// ---
// relationships:
//   verifies: [github-event-source, task-metadata]
// ---
import { afterEach, expect, test } from "vite-plus/test";
import { openStore } from "../store/index.ts";
import { startRouter } from "../router/index.ts";
import { SecretValue } from "../service-configuration/index.ts";
import { startGitHubSource } from "./index.ts";
import { githubFake } from "./test-fixtures/api.ts";
import type { TaskFieldWrite } from "./index.ts";
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).toReversed()) await cleanup();
});
const write: TaskFieldWrite = {
  actorId: "parcel",
  invokeId: "due",
  entryId: "entry",
  projectNodeId: "P_one",
  issueNodeId: "I_A",
  field: "Due",
  storage: { kind: "front-matter", key: "due" },
  labels: [],
  repositories: [],
  value: "2026-01-02",
};
async function setup(projectField = false) {
  const fake = await githubFake();
  cleanups.push(fake.close);
  fake.addItem("IT_A", "I_A");
  if (projectField)
    fake.items.get("IT_A")!.fieldValues.nodes = [
      {
        __typename: "ProjectV2ItemFieldNumberValue",
        number: 1,
        field: { id: "F_weight", name: "Weight", dataType: "NUMBER" },
      },
    ];
  const store = openStore({ path: ":memory:" });
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
  const published: import("../router/index.ts").SourceEvent[] = [];
  const options = {
    store,
    router: {
      ...router,
      publish(event: import("../router/index.ts").SourceEvent) {
        published.push(event);
        return router.publish(event);
      },
    },
    configuration: {
      apiUrl: fake.url,
      owners: { sample: { credential: "example", hooks: [] } },
      sweepIntervalMs: 900000,
      redeliveryIntervalMs: 60000,
      requestTimeoutMs: 5000,
    },
    credentials: {
      names: ["example"],
      resolve: () => ({
        kind: "github-app" as const,
        name: "example",
        installationToken: async () => new SecretValue("example", "synthetic-token"),
      }),
    },
    boundProjects: () => [{ owner: "sample", number: 1 }],
    processRepository: {
      url: "https://example.test/process.git",
      branch: "main",
      pull: async () => ({ kind: "unchanged" as const, commit: "a".repeat(40) }),
    },
    taskFieldBinding: () => "parcels",
    taskFieldValues: (_project: string, issue: import("./types.ts").TrackedIssue) => {
      if (projectField) {
        const raw = issue.items[0]!.fields["Weight"];
        const number = raw?.kind === "number" ? raw.number : undefined;
        return {
          "Parcel weight": {
            storage: "project-field" as const,
            storageName: "Weight",
            value:
              number === undefined
                ? { state: "empty" as const }
                : { state: "set" as const, value: Math.floor(number) },
          },
        };
      }
      const body = issue.content?.body ?? "";
      const due = /due: "?(\d{4}-\d{2}-\d{2})/.exec(body)?.[1];
      return {
        Due: {
          storage: "front-matter" as const,
          value: due ? { state: "set" as const, value: due } : { state: "empty" as const },
        },
      };
    },
  };
  let source = startGitHubSource(options);
  cleanups.push(async () => {
    await source.stop();
    router.stop();
    store.close();
  });
  await expect.poll(() => source.trackedIssue("I_A")?.content).toBeDefined();
  return {
    fake,
    store,
    published,
    get source() {
      return source;
    },
    async restart() {
      await source.stop();
      source = startGitHubSource(options);
    },
    events: () =>
      store.connection.database
        .prepare(
          "SELECT payload FROM store_inbox WHERE payload LIKE '%github.task-field.changed%' ORDER BY sequence",
        )
        .all()
        .map((row) => JSON.parse(row["payload"] as string) as Record<string, unknown>),
  };
}
test("front matter write preserves prose, replay sends no write, and publishes one attributed value", async () => {
  const h = await setup();
  h.fake.editBody("I_A", "Pack the parcel.\n", false);
  await h.source.writeTaskField(write);
  await h.source.writeTaskField(write);
  expect(h.fake.issues.get("I_A")!.body).toContain("Pack the parcel.\n");
  expect(h.fake.log.filter((row) => row.operation === "GitHubIssueBodyWrite")).toHaveLength(1);
  await expect.poll(() => h.events().length).toBe(1);
  expect(h.events()[0]).toMatchObject({
    type: "github.task-field.changed",
    binding: "parcels",
    field: "Due",
    from: { state: "empty" },
    to: { state: "set", value: "2026-01-02" },
    setBy: { actorId: "parcel", confirmed: true },
  });
});
test("one repair uses its own basis and retains the replaced person's prose", async () => {
  const h = await setup();
  h.fake.editBody("I_A", "Original.\n", false);
  const held = h.fake.hold("GitHubIssueBodyWrite");
  const result = h.source.writeTaskField(write);
  await held.reached;
  h.fake.editBody("I_A", "Added by person.\n", false);
  held.release();
  await result;
  expect(h.fake.issues.get("I_A")!.body).toContain("Added by person.\n");
  expect(h.fake.log.filter((row) => row.operation === "GitHubIssueBodyWrite")).toHaveLength(2);
  await h.source.writeTaskField(write);
  expect(h.fake.log.filter((row) => row.operation === "GitHubIssueBodyWrite")).toHaveLength(2);
});
test("pending check survives restart before equal-value shortcut; conflict replay writes nothing", async () => {
  const h = await setup();
  h.fake.editBody("I_A", "Original.\n", false);
  await h.source.writeTaskField(write);
  h.store.connection.database
    .prepare("UPDATE github_task_field_write SET check_state='pending',status='sent'")
    .run();
  h.fake.editBody("I_A", h.fake.issues.get("I_A")!.body! + "Later edit.\n", false);
  await h.restart();
  await expect(h.source.writeTaskField(write)).rejects.toMatchObject({ kind: "body-conflict" });
  await expect(h.source.writeTaskField(write)).rejects.toMatchObject({ kind: "body-conflict" });
  expect(h.fake.log.filter((row) => row.operation === "GitHubIssueBodyWrite")).toHaveLength(1);
  expect(h.fake.issues.get("I_A")!.body).toContain("Later edit.");
});

test("a foreign edit during the sole repair refuses the write and replay sends nothing", async () => {
  const h = await setup();
  h.fake.editBody("I_A", "Original.\n", false);
  const first = h.fake.hold("GitHubIssueBodyWrite");
  const result = h.source.writeTaskField(write);
  const refused = expect(result).rejects.toMatchObject({ kind: "body-conflict" });
  await first.reached;
  h.fake.editBody("I_A", "First person's edit.\n", false);
  const repair = h.fake.hold("GitHubIssueBodyWrite");
  first.release();
  await repair.reached;
  h.fake.editBody("I_A", "Second person's edit during repair.\n", false);
  repair.release();
  await refused;
  expect(h.fake.log.filter((row) => row.operation === "GitHubIssueBodyWrite")).toHaveLength(2);
  await expect(h.source.writeTaskField(write)).rejects.toMatchObject({ kind: "body-conflict" });
  await h.restart();
  await expect(h.source.writeTaskField(write)).rejects.toMatchObject({ kind: "body-conflict" });
  expect(h.fake.log.filter((row) => row.operation === "GitHubIssueBodyWrite")).toHaveLength(2);
});

test("external changes lose attribution and repeated normalized values keep the persisted event stable", async () => {
  const h = await setup();
  await h.source.writeTaskField(write);
  await expect.poll(() => h.events().length).toBe(1);
  expect(h.events()[0]?.["setBy"]).toEqual({ actorId: "parcel", confirmed: true });
  const eventIds = () =>
    h.store.connection.database
      .prepare(
        "SELECT event_id FROM store_inbox WHERE payload LIKE '%github.task-field.changed%' ORDER BY sequence",
      )
      .all()
      .map((row) => row["event_id"]);
  const originalIds = eventIds();
  h.fake.editBody("I_A", "---\ndue: 2026-01-02\n---\n\nPerson adds prose.\n", false);
  h.source.requestSweep();
  await expect
    .poll(() => h.source.trackedIssue("I_A")?.content?.body)
    .toContain("Person adds prose.");
  expect(h.events()).toHaveLength(1);
  expect(eventIds()).toEqual(originalIds);
  await h.restart();
  await expect
    .poll(() => h.source.trackedIssue("I_A")?.content?.body)
    .toContain("Person adds prose.");
  expect(eventIds()).toEqual(originalIds);
  h.fake.editBody("I_A", '---\ndue: "2026-01-03"\n---\n\nPerson changes the due date.\n', false);
  h.source.requestSweep();
  await expect.poll(() => h.events().length).toBe(2);
  expect(h.events()[1]).toMatchObject({
    from: { state: "set", value: "2026-01-02" },
    to: { state: "set", value: "2026-01-03" },
    setBy: null,
  });
  const changedIds = eventIds();
  expect(new Set(changedIds).size).toBe(2);
  await h.source.writeTaskField(write);
  expect(h.fake.log.filter((row) => row.operation === "GitHubIssueBodyWrite")).toHaveLength(1);
  expect(h.fake.issues.get("I_A")!.body).toContain("2026-01-03");
  await h.restart();
  expect(eventIds()).toEqual(changedIds);
});

test.each([0, 1])(
  "body history lag recovers the same invocation after %i additional unavailable checks",
  async (repeats) => {
    const h = await setup();
    h.fake.lagBodyEdits(true);
    await expect(h.source.writeTaskField(write)).rejects.toMatchObject({ kind: "transport" });
    expect(h.fake.issues.get("I_A")!.body).toContain("2026-01-02");
    for (let check = 0; check < repeats; check++)
      await expect(h.source.writeTaskField(write)).rejects.toMatchObject({ kind: "transport" });
    expect(h.fake.log.filter((row) => row.operation === "GitHubIssueBodyWrite")).toHaveLength(1);
    h.fake.lagBodyEdits(false);
    await expect(h.source.writeTaskField(write)).resolves.toBeUndefined();
    await h.source.writeTaskField(write);
    expect(h.fake.log.filter((row) => row.operation === "GitHubIssueBodyWrite")).toHaveLength(1);
    h.fake.editBody("I_A", '---\ndue: "2026-01-03"\n---\n\nExternal edit after recovery.\n', false);
    await h.source.writeTaskField(write);
    expect(h.fake.issues.get("I_A")!.body).toContain("2026-01-03");
    expect(h.fake.log.filter((row) => row.operation === "GitHubIssueBodyWrite")).toHaveLength(1);
  },
);

test("distinct body edits at the initial read's exact timestamp refuse instead of repairing", async () => {
  const h = await setup();
  h.fake.editBody("I_A", "Original.\n", false);
  const basis = h.fake.issues.get("I_A")!.lastEditedAt!;
  const held = h.fake.hold("GitHubIssueBodyWrite");
  const result = h.source.writeTaskField(write);
  const refused = expect(result).rejects.toMatchObject({ kind: "body-conflict" });
  await held.reached;
  h.fake.editBody("I_A", "Foreign body at the same timestamp.\n", false, basis);
  held.release();
  await refused;
  await expect(h.source.writeTaskField(write)).rejects.toMatchObject({ kind: "body-conflict" });
  expect(h.fake.log.filter((row) => row.operation === "GitHubIssueBodyWrite")).toHaveLength(1);
});

test("newer foreign and own edits sharing a timestamp refuse instead of repairing", async () => {
  const h = await setup();
  h.fake.editBody("I_A", "Original.\n", false);
  const held = h.fake.hold("GitHubIssueBodyWrite");
  const result = h.source.writeTaskField(write);
  const refused = expect(result).rejects.toMatchObject({ kind: "body-conflict" });
  await held.reached;
  h.fake.editBody("I_A", "Foreign edit.\n", false);
  h.fake.nextBodyEditAt(h.fake.issues.get("I_A")!.lastEditedAt!);
  held.release();
  await refused;
  await expect(h.source.writeTaskField(write)).rejects.toMatchObject({ kind: "body-conflict" });
  expect(h.fake.log.filter((row) => row.operation === "GitHubIssueBodyWrite")).toHaveLength(1);
});

test("a distinct foreign edit at the repair's basis timestamp refuses without a third write", async () => {
  const h = await setup();
  h.fake.editBody("I_A", "Original.\n", false);
  const first = h.fake.hold("GitHubIssueBodyWrite");
  const result = h.source.writeTaskField(write);
  const refused = expect(result).rejects.toMatchObject({ kind: "body-conflict" });
  await first.reached;
  h.fake.editBody("I_A", "First person's edit.\n", false);
  const repair = h.fake.hold("GitHubIssueBodyWrite");
  first.release();
  await repair.reached;
  const basis = h.fake.issues.get("I_A")!.lastEditedAt!;
  h.fake.editBody("I_A", "Second person's edit at the repair basis.\n", false, basis);
  repair.release();
  await refused;
  await expect(h.source.writeTaskField(write)).rejects.toMatchObject({ kind: "body-conflict" });
  await h.restart();
  await expect(h.source.writeTaskField(write)).rejects.toMatchObject({ kind: "body-conflict" });
  expect(h.fake.log.filter((row) => row.operation === "GitHubIssueBodyWrite")).toHaveLength(2);
});

test("two newer foreign edits sharing a timestamp refuse rather than choosing a repair body", async () => {
  const h = await setup();
  h.fake.editBody("I_A", "Original.\n", false);
  const held = h.fake.hold("GitHubIssueBodyWrite");
  const result = h.source.writeTaskField(write);
  const refused = expect(result).rejects.toMatchObject({ kind: "body-conflict" });
  await held.reached;
  h.fake.editBody("I_A", "First foreign edit.\n", false);
  const at = h.fake.issues.get("I_A")!.lastEditedAt!;
  h.fake.editBody("I_A", "Other foreign edit with the same timestamp.\n", false, at);
  held.release();
  await refused;
  await expect(h.source.writeTaskField(write)).rejects.toMatchObject({ kind: "body-conflict" });
  expect(h.fake.log.filter((row) => row.operation === "GitHubIssueBodyWrite")).toHaveLength(1);
});

test("repair history lag keeps the same invocation pending without a third write", async () => {
  const h = await setup();
  h.fake.editBody("I_A", "Original.\n", false);
  const first = h.fake.hold("GitHubIssueBodyWrite");
  const result = h.source.writeTaskField(write);
  const pending = expect(result).rejects.toMatchObject({ kind: "transport" });
  await first.reached;
  h.fake.editBody("I_A", "Person's replaced prose.\n", false);
  const repair = h.fake.hold("GitHubIssueBodyWrite");
  first.release();
  await repair.reached;
  h.fake.lagBodyEdits(true);
  repair.release();
  await pending;
  await expect(h.source.writeTaskField(write)).rejects.toMatchObject({ kind: "transport" });
  expect(h.fake.log.filter((row) => row.operation === "GitHubIssueBodyWrite")).toHaveLength(2);
  expect(h.fake.issues.get("I_A")!.body).toContain("Person's replaced prose.");
  h.fake.lagBodyEdits(false);
  await h.source.writeTaskField(write);
  await h.source.writeTaskField(write);
  expect(h.fake.log.filter((row) => row.operation === "GitHubIssueBodyWrite")).toHaveLength(2);
});

test("task field identity uses the issue content revision and only the issue topic", async () => {
  const h = await setup();
  h.fake.editBody("I_A", "Prose changes without changing a field.\n", false);
  h.source.requestSweep();
  await expect.poll(() => h.source.trackedIssue("I_A")?.content?.body).toContain("Prose changes");
  h.fake.editBody("I_A", "---\ndue: 2026-01-02\n---\nProse.\n", false);
  h.source.requestSweep();
  await expect.poll(() => h.events().length).toBe(1);
  const event = h.published.find((event) => event.event.type === "github.task-field.changed");
  expect(event).toMatchObject({
    eventId: "task-field:I_A:P_one:9071738f145962a6:2",
    topics: ["github.issue.I_A"],
  });
});

test("Project task field identity uses the raw field value revision with a declared alias", async () => {
  const h = await setup(true);
  h.fake.items.get("IT_A")!.fieldValues.nodes[0]!["number"] = 1.5;
  h.source.requestSweep();
  await expect
    .poll(() => h.source.trackedIssue("I_A")?.items[0]?.fields["Weight"])
    .toMatchObject({ number: 1.5 });
  expect(h.events()).toHaveLength(0);
  h.fake.items.get("IT_A")!.fieldValues.nodes[0]!["number"] = 2;
  h.source.requestSweep();
  await expect.poll(() => h.events().length).toBe(1);
  expect(
    h.published.find((event) => event.event.type === "github.task-field.changed"),
  ).toMatchObject({
    eventId: "task-field:I_A:P_one:8d29eafa99a4d3e7:2",
    topics: ["github.issue.I_A"],
  });
});
