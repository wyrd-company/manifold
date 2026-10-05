// ---
// relationships:
//   verifies: [github-event-source, task-metadata]
// ---
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, test } from "vite-plus/test";
import { childProcessLimit } from "../../../../test-support/limits.ts";
import { openStore } from "../store/index.ts";
import { startRouter } from "../router/index.ts";
import { SecretValue } from "../service-configuration/index.ts";
import { startGitHubSource } from "./index.ts";
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
async function setup(withScan = false) {
  const clock = new FakeClock();
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
  const secretFile = join(directory, "hook.secret");
  writeFileSync(secretFile, "synthetic-secret");
  const options = {
    store,
    router,
    ...(withScan ? { clock } : {}),
    configuration: {
      apiUrl: fake.url,
      owners: {
        sample: {
          credential: "example",
          hooks: withScan ? [{ id: 1, repository: undefined, secretFile }] : [],
        },
      },
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
    boundProjects: () => [{ owner: "sample", number: 1 }],
    processRepository: {
      url: "https://example.test/sample/process.git",
      branch: "main",
      pull: async () => ({ kind: "unchanged" as const, commit: "a".repeat(40) }),
    },
  };
  let source = startGitHubSource(options);
  cleanups.push(async () => {
    await source.stop();
    router.stop();
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
  await expect
    .poll(() => source.trackedIssue("I_A")?.items.length, { timeout: childProcessLimit })
    .toBe(1);
  const events = () =>
    store.connection.database
      .prepare(
        "SELECT payload FROM store_inbox WHERE payload LIKE '%github.project-item.field-changed%' ORDER BY sequence",
      )
      .all()
      .map((row) => JSON.parse(row["payload"] as string));
  return {
    fake,
    get source() {
      return source;
    },
    store,
    events,
    clock,
    async restart() {
      await source.stop();
      source = startGitHubSource(options);
    },
  };
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

test("a missing Project in the field query is field-missing, not item-missing", async () => {
  const { fake, source } = await setup();
  fake.failQuery("GitHubProjectField", "NOT_FOUND");
  await expect(source.moveCard(move)).rejects.toMatchObject({ kind: "field-missing" });
});
test("queued moves precede due scans and sweeps, and drain between scan requests", async () => {
  const { fake, source, clock } = await setup(true);
  for (let id = 1; id <= 101; id++)
    fake.deliveries.push({
      id,
      guid: `delivery-${id}`,
      delivered_at: new Date(clock.time).toISOString(),
      status_code: 200,
      event: "issues",
      payload: {},
    });
  fake.deliveries[0]!.status_code = 500;
  fake.deliveries[1]!.status_code = 500;
  fake.log.length = 0;
  clock.advance(900000);
  const first = source.moveCard(move);
  await first;
  await expect.poll(() => fake.redeliveries.length).toBe(2);
  expect(fake.log[0]!.operation).toBe("GitHubProjectField");
  expect(fake.log[1]!.operation).toBe("GitHubCardMove");
  fake.deliveries[2]!.status_code = 500;
  const scan = fake.hold("GitHubDeliveries");
  clock.advance(60000);
  await scan.reached;
  const offset = fake.log.length;
  const second = source.moveCard({ ...move, entryId: "second", option: "Shipped" });
  scan.release();
  await second;
  await expect.poll(() => fake.redeliveries.length).toBe(3);
  expect(fake.log[offset]!.operation).toBe("GitHubProjectField");
  expect(fake.log[offset + 1]!.operation).toBe("GitHubCardMove");
  fake.deliveries[3]!.status_code = 500;
  fake.deliveries[4]!.status_code = 500;
  const redelivery = fake.hold("GitHubRedeliver");
  clock.advance(60000);
  await redelivery.reached;
  const afterRequest = fake.log.length;
  const third = source.moveCard({ ...move, entryId: "third" });
  redelivery.release();
  await third;
  await expect.poll(() => fake.redeliveries.length).toBe(5);
  expect(fake.log[afterRequest]!.operation).toBe("GitHubProjectField");
  expect(fake.log[afterRequest + 1]!.operation).toBe("GitHubCardMove");
});
test("a refused replay after restart preserves the confirmed attempt and its sequence", async () => {
  const f = await setup();
  f.fake.lagItem("IT_A");
  await f.source.moveCard(move);
  const row = () => f.store.connection.database.prepare("SELECT * FROM github_card_move").get();
  const confirmed = row();
  expect(confirmed).toMatchObject({ state: "confirmed" });
  await f.restart();
  const observation = f.fake.hold("GitHubProject");
  f.source.requestSweep();
  await observation.reached;
  f.fake.failWrite("FORBIDDEN");
  const replay = expect(f.source.moveCard(move)).rejects.toMatchObject({ kind: "forbidden" });
  observation.release();
  await replay;
  expect(row()).toEqual(confirmed);
  f.fake.resumeItem("IT_A");
  f.source.requestSweep();
  await expect.poll(() => f.events().length).toBe(1);
  expect(f.events()[0]).toMatchObject({
    movedBy: { actorId: "parcel", confirmed: true },
    to: { name: "Packed" },
  });
});
test("a person's intervening value makes the second lagged move unconfirmed", async () => {
  const { fake, source, events } = await setup();
  fake.lagItem("IT_A");
  await source.moveCard(move);
  fake.items.get("IT_A")!.fieldValues.nodes[0]!["name"] = "Sorting again";
  fake.items.get("IT_A")!.fieldValues.nodes[0]!["optionId"] = "O_person";
  fake.lagItem("IT_A");
  await source.moveCard({ ...move, entryId: "second", option: "Shipped" });
  await expect.poll(() => events().length).toBe(1);
  expect(events()[0]).toMatchObject({ movedBy: null });
  fake.resumeItem("IT_A");
  source.requestSweep();
  await expect.poll(() => events().length).toBe(2);
  expect(events()[1]).toMatchObject({ movedBy: { actorId: "parcel", confirmed: false } });
});
test("a replay after attribution followed by away-and-back is unconfirmed", async () => {
  const { fake, source, events } = await setup();
  await source.moveCard(move);
  await expect.poll(() => events().length).toBe(1);
  await source.moveCard(move);
  fake.items.get("IT_A")!.fieldValues.nodes[0]!["name"] = "Shipped";
  fake.items.get("IT_A")!.fieldValues.nodes[0]!["optionId"] = "O_shipped";
  source.requestSweep();
  await expect.poll(() => events().length).toBe(2);
  expect(events()[1]).toMatchObject({ movedBy: null });
  fake.items.get("IT_A")!.fieldValues.nodes[0]!["name"] = "Packed";
  fake.items.get("IT_A")!.fieldValues.nodes[0]!["optionId"] = "O_packed";
  source.requestSweep();
  await expect.poll(() => events().length).toBe(3);
  expect(events()[2]).toMatchObject({ movedBy: { actorId: "parcel", confirmed: false } });
});
test("moving onto the held option resolves without a field-change event", async () => {
  const { fake, source, events } = await setup();
  await source.moveCard({ ...move, option: "Sorting" });
  const observation = fake.hold("GitHubProject");
  source.requestSweep();
  await observation.reached;
  const afterCommit = fake.hold("GitHubIssues");
  observation.release();
  await afterCommit.reached;
  expect(events()).toEqual([]);
  afterCommit.release();
});
