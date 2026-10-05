// ---
// relationships:
//   verifies: [github-event-source, task-metadata]
// ---
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, test } from "vite-plus/test";
import { openStore } from "../store/index.ts";
import { startRouter } from "../router/index.ts";
import { SecretValue } from "../service-configuration/index.ts";
import { startGitHubSource } from "./index.ts";
import { githubFake } from "./test-fixtures/api.ts";
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
async function setup() {
  const fake = await githubFake();
  cleanups.push(fake.close);
  fake.addItem("IT_A", "I_A");
  fake.items.get("IT_A")!.fieldValues.nodes = [
    {
      field: { id: "F_stage", name: "Stage", dataType: "SINGLE_SELECT" },
      optionId: "O_sorting",
      name: "Sorting",
    },
  ];
  const directory = mkdtempSync(join(tmpdir(), "card-move-"));
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
  const source = startGitHubSource({
    store,
    router,
    configuration: {
      apiUrl: fake.url,
      owners: { sample: { credential: "example", hooks: [] } },
      sweepIntervalMs: 900000,
      redeliveryIntervalMs: 60000,
      requestTimeoutMs: 100,
    },
    credentials: {
      names: ["example"],
      resolve: () => ({
        kind: "github-app",
        name: "example",
        installationToken: async () => new SecretValue("example", "synthetic-token"),
      }),
    },
    boundProjects: () => [{ owner: "sample", number: 1 }],
    processRepository: {
      url: "https://example.test/sample/process.git",
      branch: "main",
      pull: async () => ({ kind: "unchanged", commit: "a".repeat(40) }),
    },
  });
  cleanups.push(async () => {
    await source.stop();
    router.stop();
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
  await expect.poll(() => source.trackedIssue("I_A")?.items.length).toBe(1);
  const events = () =>
    store.connection.database
      .prepare(
        "SELECT payload FROM store_inbox WHERE payload LIKE '%github.project-item.field-changed%' ORDER BY sequence",
      )
      .all()
      .map((row) => JSON.parse(row["payload"] as string));
  return { fake, source, store, events };
}
test("sets one value on replay, publishes its confirmed move, and distinguishes a person's move", async () => {
  const { fake, source, events } = await setup();
  await source.moveCard(move);
  await source.moveCard(move);
  await expect.poll(() => events().length).toBe(1);
  expect(events()[0]).toMatchObject({
    type: "github.project-item.field-changed",
    to: { name: "Packed" },
    movedBy: { actorId: "parcel", confirmed: true },
  });
  expect(
    fake.log
      .filter((row) => row.operation === "GitHubCardMove")
      .map((row) => row.variables["option"]),
  ).toEqual(["O_packed", "O_packed"]);
  fake.items.get("IT_A")!.fieldValues.nodes[0]!["optionId"] = "O_shipped";
  fake.items.get("IT_A")!.fieldValues.nodes[0]!["name"] = "Shipped";
  source.requestSweep();
  await expect.poll(() => events().length).toBe(2);
  expect(events()[1]).toMatchObject({ movedBy: null, to: { name: "Shipped" } });
});
test.each([
  ["field-missing", "field"],
  ["option-missing", "option"],
  ["item-missing", "item"],
  ["forbidden", "FORBIDDEN"],
  ["transport", "502"],
  ["rejected", "UNPROCESSABLE"],
])("typed failure: %s", async (kind, fault) => {
  const { fake, source, store } = await setup();
  if (fault === "field") fake.fields.length = 0;
  else if (fault === "option") fake.fields[0]!.options.length = 0;
  else if (fault === "item") fake.items.clear();
  else fake.failWrite(fault, fault === "502" ? 502 : undefined);
  await expect(source.moveCard(move)).rejects.toMatchObject({ kind });
  expect(
    store.connection.database.prepare("SELECT count(*) AS n FROM github_card_move").get()?.["n"],
  ).toBe(kind === "transport" ? 1 : 0);
});
test("timeout leaves an uncertain attempt and a later same-option selection is unconfirmed", async () => {
  const { fake, source, events } = await setup();
  const held = fake.hold("GitHubCardMove");
  const result = source.moveCard(move);
  const refused = expect(result).rejects.toMatchObject({ kind: "transport" });
  await held.reached;
  await refused;
  // The server still takes the write after the client's deadline: it could equally be a person selecting this value.
  held.release();
  source.requestSweep();
  await expect.poll(() => events().length).toBe(1);
  expect(events()[0]).toMatchObject({ movedBy: { actorId: "parcel", confirmed: false } });
});
test("a paginated observation commits before a queued move, preserving attribution", async () => {
  const { fake, source, events } = await setup();
  fake.items.get("IT_A")!.fieldValues.nodes[0]!["name"] = "Shipped";
  fake.items.get("IT_A")!.fieldValues.nodes[0]!["optionId"] = "O_shipped";
  fake.items.get("IT_A")!.fieldValues.nodes.push({
    field: { id: "F_note", name: "Label", dataType: "TEXT" },
    text: "Parcel",
  });
  fake.paginateItem("IT_A");
  const held = fake.hold("GitHubConnection");
  source.requestSweep();
  await held.reached;
  const moved = source.moveCard(move);
  await new Promise((resolve) => setImmediate(resolve));
  expect(fake.log.some((row) => row.operation === "GitHubCardMove")).toBe(false);
  held.release();
  await moved;
  await expect.poll(() => events().some((event) => event.to?.name === "Packed")).toBe(true);
  expect(events().find((event) => event.to?.name === "Shipped")).toMatchObject({ movedBy: null });
  expect(events().find((event) => event.to?.name === "Packed")).toMatchObject({
    movedBy: { actorId: "parcel", confirmed: true },
  });
});

test("a failed observation does not strand a queued card move", async () => {
  const { fake, source } = await setup();
  const held = fake.hold("GitHubProject");
  source.requestSweep();
  await held.reached;
  let settled = false;
  const moved = source.moveCard(move).then(() => {
    settled = true;
  });
  fake.fail(502);
  held.release();
  await expect.poll(() => settled).toBe(true);
  await moved;
});
