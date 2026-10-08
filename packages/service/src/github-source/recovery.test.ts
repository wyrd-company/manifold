// ---
// relationships:
//   verifies: github-event-source
// ---
import { DatabaseSync } from "node:sqlite";
import { generateKeyPairSync } from "node:crypto";
import { apiFixture } from "../process-repository/test-fixtures/remote.ts";
import { SecretValue, loadServiceConfiguration } from "../service-configuration/index.ts";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import { afterEach, expect, test } from "vite-plus/test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parse, stringify } from "yaml";
import { openStore } from "../store/index.ts";
import { startRouter } from "../router/index.ts";
import type { JsonValue } from "../store/index.ts";
import { startGitHubSource } from "./index.ts";
import type { GitHubSourceError } from "./index.ts";
import { githubFake, FakeClock, signedDelivery } from "./test-fixtures/api.ts";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0).toReversed()) await fn();
});
async function setup(
  intervals: { sweepIntervalMs?: number; redeliveryIntervalMs?: number } = {},
  onMirrorChanged?: () => void,
) {
  const fake = await githubFake();
  cleanup.push(fake.close);
  const directory = mkdtempSync(join(tmpdir(), "github-recovery-"));
  const secretFile = join(directory, "hook-secret");
  writeFileSync(secretFile, "synthetic-secret");
  const path = join(directory, "store.sqlite");
  const store = openStore({ path });
  const clock = new FakeClock();
  const taken: { actor: string; payload: JsonValue }[] = [];
  const errors: GitHubSourceError[] = [];
  const pulls: (string | undefined)[] = [];
  const discoveries: { ids: readonly string[]; baselined: unknown; events: unknown }[] = [];
  for (const actor of ["I_A", "I_B", "I_C", "I_D", "I_X", "project"])
    store.saveSnapshot({
      actorId: actor,
      machine: "record",
      snapshot: { status: "active", value: "waiting" },
    });
  const router = startRouter({
    store,
    clock,
    host: {
      subscription: (actor) => ({
        topics: [
          actor.actorId === "project" ? "github.project.P_one" : `github.issue.${actor.actorId}`,
        ],
      }),
      restore: (stored) => ({
        status: "restored",
        target: {
          actorId: stored.actorId,
          send: (row) => taken.push({ actor: stored.actorId, payload: row.payload }),
          persist: () => ({ machine: "record", snapshot: { status: "active", value: "waiting" } }),
        },
      }),
    },
  });
  const options = {
    ...(onMirrorChanged ? { onMirrorChanged } : {}),
    store,
    router,
    clock,
    configuration: {
      apiUrl: fake.url,
      owners: {
        sample: {
          credential: "sample-token",
          hooks: [{ id: 1, repository: undefined, secretFile }],
        },
      },
      sweepIntervalMs: 900000,
      redeliveryIntervalMs: 60000,
      requestTimeoutMs: 30000,
      ...intervals,
    },
    credentials: {
      names: ["sample-token"],
      resolve: () => ({
        kind: "github-app" as const,
        name: "sample-token",
        installationToken: async () => new SecretValue("example-app", "synthetic-token"),
      }),
    },
    boundProjects: () => [{ owner: "sample", number: 1 }],
    processRepository: {
      url: "https://example.test/sample/process.git",
      branch: "main",
      pull: async (request?: { commit?: string }) => {
        pulls.push(request?.commit);
        return { kind: "unchanged" as const, commit: "a".repeat(40) };
      },
    },
    onError: (error: GitHubSourceError) => errors.push(error),
    onTracked: (ids: readonly string[]) => {
      const committed = new DatabaseSync(path);
      try {
        discoveries.push({
          ids,
          baselined: committed
            .prepare("SELECT baselined FROM github_issue WHERE issue_node_id=?")
            .get(ids[0]!),
          events: committed
            .prepare(
              "SELECT count(*) AS count FROM router_source_event WHERE event_id LIKE 'item:%'",
            )
            .get(),
        });
      } finally {
        committed.close();
      }
    },
  };
  const source = startGitHubSource(options);
  const server = createServer(source.requestListener);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  fake.setTarget(url);
  cleanup.push(async () => {
    await source.stop();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    router.stop();
    store.close();
    rmSync(directory, { recursive: true });
  });
  const idle = async () => {
    await new Promise((resolve) => setImmediate(resolve));
    await expect.poll(() => pulls.length).toBeGreaterThan(0);
    await expect
      .poll(
        () =>
          store.connection.database.prepare("SELECT count(*) AS count FROM github_pending").get()?.[
            "count"
          ],
        { timeout: 3000 },
      )
      .toBe(0);
    await new Promise((resolve) => setImmediate(resolve));
  };
  const events = () =>
    store.connection.database
      .prepare("SELECT event_id,event FROM router_source_event ORDER BY rowid")
      .all();
  return {
    fake,
    source,
    store,
    clock,
    taken,
    errors,
    pulls,
    url,
    idle,
    events,
    options,
    path,
    discoveries,
  };
}
test("sweep recovers a dropped dependency and a later delivery publishes nothing", async () => {
  const s = await setup();
  s.fake.addItem("IT_A", "I_A");
  s.source.requestSweep();
  await s.idle();
  s.fake.dependencies.push(["I_A", "I_X"]);
  s.source.requestSweep();
  await s.idle();
  expect(s.source.trackedIssue("I_A")?.blockedBy.map((i) => i.nodeId)).toEqual(["I_X"]);
  const count = s.store.connection.database
    .prepare("SELECT count(*) AS count FROM router_source_event WHERE event_id LIKE 'dependency:%'")
    .get()?.["count"];
  expect(count).toBe(1);
  s.source.receive(signedDelivery("issue_dependencies", { blocking_issue: { node_id: "I_X" } }));
  await s.idle();
  expect(
    s.store.connection.database
      .prepare(
        "SELECT count(*) AS count FROM router_source_event WHERE event_id LIKE 'dependency:%'",
      )
      .get()?.["count"],
  ).toBe(1);
  expect(s.errors).toEqual([]);
});
test("a blocker close reaches each directly blocked issue with one event", async () => {
  const s = await setup();
  for (const id of ["I_A", "I_B", "I_C", "I_D"]) s.fake.addItem(`IT_${id}`, id);
  s.fake.dependencies.push(["I_A", "I_X"], ["I_B", "I_X"], ["I_C", "I_X"], ["I_D", "I_A"]);
  s.source.requestSweep();
  await s.idle();
  s.taken.length = 0;
  s.fake.issues.get("I_X")!.state = "CLOSED";
  s.fake.issues.get("I_X")!.stateReason = "COMPLETED";
  s.source.receive(signedDelivery("issues", { issue: { node_id: "I_X" } }));
  await s.idle();
  expect(
    s.taken
      .filter((e) => (e.payload as { type: string }).type === "github.issue.closed")
      .map((e) => e.actor)
      .sort(),
  ).toEqual(["I_A", "I_B", "I_C", "I_X"]);
  s.taken.length = 0;
  s.fake.issues.get("I_A")!.state = "CLOSED";
  s.source.receive(signedDelivery("issues", { issue: { node_id: "I_A" } }, "close-a"));
  await s.idle();
  expect(
    s.taken
      .filter((e) => (e.payload as { type: string }).type === "github.issue.closed")
      .map((e) => e.actor)
      .sort(),
  ).toEqual(["I_A", "I_D"]);
});
test("item discovery waits for a complete baseline including pagination", async () => {
  const s = await setup();
  await s.idle();
  s.fake.addItem("IT_A", "I_A");
  s.fake.dependencies.push(["I_A", "I_X"], ["I_A", "I_B"]);
  s.fake.paginateIssue("I_A");
  const held = s.fake.hold("GitHubIssues");
  s.source.receive(
    signedDelivery("projects_v2_item", {
      projects_v2_item: { node_id: "IT_A", project_node_id: "P_one" },
    }),
  );
  await held.reached;
  expect(s.source.trackedIssue("I_A")).toBeUndefined();
  expect(s.taken).toEqual([]);
  held.release();
  await s.idle();
  expect(
    s.source
      .trackedIssue("I_A")
      ?.blockedBy.map((i) => i.nodeId)
      .sort(),
  ).toEqual(["I_B", "I_X"]);
  expect(
    s.taken.filter((e) => (e.payload as { type: string }).type === "github.project-item.added"),
  ).toHaveLength(2);
  expect(s.errors).toEqual([]);
});
test("redelivery asks once for a failed GUID and sweep produces no duplicate", async () => {
  const s = await setup();
  s.fake.addItem("IT_A", "I_A");
  s.source.requestSweep();
  await s.idle();
  s.fake.dependencies.push(["I_A", "I_X"]);
  s.fake.deliveries.push({
    id: 1,
    guid: "lost",
    delivered_at: new Date(s.clock.now() + 1).toISOString(),
    status_code: 502,
    event: "issue_dependencies",
    payload: { blocked_issue: { node_id: "I_A" } },
  });
  // The pending queue can be empty while a 30 s HTTP request is still active.
  await expect
    .poll(
      () =>
        s.clock.timers.size === 2 &&
        [...s.clock.timers].every((timer) => timer.at - s.clock.now() >= 60000),
    )
    .toBe(true);
  s.clock.advance(60000);
  await expect.poll(() => s.fake.redeliveries).toEqual([1]);
  await s.idle();
  // The pending queue can be empty while a 30 s HTTP request is still active.
  await expect
    .poll(
      () =>
        s.clock.timers.size === 2 &&
        [...s.clock.timers].every((timer) => timer.at - s.clock.now() >= 60000),
    )
    .toBe(true);
  s.clock.advance(60000);
  await s.idle();
  s.source.requestSweep();
  await s.idle();
  expect(s.fake.redeliveries).toEqual([1]);
  expect(s.errors).toEqual([]);
});
test("push matches the process repository and pulls once per GUID", async () => {
  const s = await setup();
  await s.idle();
  const priorPulls = s.pulls.length;
  const payload = {
    ref: "refs/heads/main",
    after: "b".repeat(40),
    deleted: false,
    repository: {
      clone_url: "https://EXAMPLE.test/Sample/Process.git/",
      html_url: "https://example.test/sample/process",
    },
  };
  s.source.receive(signedDelivery("push", payload));
  s.source.receive(signedDelivery("push", payload));
  s.source.receive(signedDelivery("push", { ...payload, ref: "refs/heads/other" }, "other-branch"));
  await s.idle();
  expect(s.pulls.slice(priorPulls)).toEqual(["b".repeat(40)]);
});
test("a newly discovered archived item is read directly and gains its baseline", async () => {
  const s = await setup();
  await s.idle();
  s.fake.addItem("IT_A", "I_A");
  s.fake.items.get("IT_A")!.isArchived = true;
  s.source.receive(
    signedDelivery("projects_v2_item", {
      projects_v2_item: { node_id: "IT_A", project_node_id: "P_one" },
    }),
  );
  await s.idle();
  expect(s.source.trackedIssue("I_A")?.issue.nodeId).toBe("I_A");
  expect(
    s.taken.filter((e) => (e.payload as { type: string }).type === "github.project-item.added"),
  ).toHaveLength(2);
});
test("a request made during a read in the same tick survives that read", async () => {
  const s = await setup();
  s.fake.addItem("IT_A", "I_A");
  s.source.requestSweep();
  await s.idle();
  const reads = () => s.fake.log.filter((row) => row.operation === "GitHubIssues").length;
  const before = reads();
  const held = s.fake.hold("GitHubIssues");
  s.source.receive(signedDelivery("issues", { issue: { node_id: "I_A" } }, "one"));
  await held.reached;
  s.source.receive(signedDelivery("issues", { issue: { node_id: "I_A" } }, "two"));
  held.release();
  await s.idle();
  expect(reads() - before).toBe(2);
});
test.each([502, 403, 429])(
  "API status %s keeps work pending until the next wake",
  async (status) => {
    const s = await setup();
    s.fake.addItem("IT_A", "I_A");
    s.source.requestSweep();
    await s.idle();
    s.fake.fail(status);
    s.fake.issues.get("I_A")!.state = "CLOSED";
    s.source.receive(signedDelivery("issues", { issue: { node_id: "I_A" } }));
    await expect.poll(() => s.errors.length).toBe(1);
    expect(s.errors[0]?.kind).toBe("api");
    expect(s.errors[0]?.status).toBe(status);
    expect(
      s.store.connection.database.prepare("SELECT count(*) AS count FROM github_pending").get()?.[
        "count"
      ],
    ).toBe(1);
    s.clock.advance(60000);
    await s.idle();
    expect(s.source.trackedIssue("I_A")?.issue.state).toBe("closed");
  },
);
test("a request timeout leaves work pending and stop aborts an active request", async () => {
  const s = await setup();
  s.fake.addItem("IT_A", "I_A");
  s.source.requestSweep();
  await s.idle();
  const held = s.fake.hold("GitHubIssues");
  s.source.receive(signedDelivery("issues", { issue: { node_id: "I_A" } }));
  await held.reached;
  s.clock.advance(30000);
  await expect.poll(() => s.errors.length).toBe(1);
  expect(s.errors[0]?.kind).toBe("api");
  expect(
    s.store.connection.database.prepare("SELECT count(*) AS count FROM github_pending").get()?.[
      "count"
    ],
  ).toBe(1);
  held.release();
  s.clock.advance(60000);
  await s.idle();
  const stopping = s.fake.hold("GitHubIssues");
  s.source.receive(signedDelivery("issues", { issue: { node_id: "I_A" } }, "stopping"));
  await stopping.reached;
  await s.source.stop();
  stopping.release();
  await s.source.stop();
  expect(() => s.source.receive(signedDelivery("ping", {}))).toThrow(TypeError);
});
test.each(["I_A", "I_B"])(
  "a shared relationship publishes once when %s is read first",
  async (first) => {
    const s = await setup();
    s.fake.addItem("IT_A", "I_A");
    s.source.requestSweep();
    await s.idle();
    s.fake.addItem("IT_B", "I_B");
    s.fake.dependencies.push(["I_A", "I_B"]);
    if (first === "I_A") {
      s.source.receive(signedDelivery("issues", { issue: { node_id: "I_A" } }));
      await s.idle();
    }
    s.source.receive(
      signedDelivery(
        "projects_v2_item",
        { projects_v2_item: { node_id: "IT_B", project_node_id: "P_one" } },
        "new-item",
      ),
    );
    await s.idle();
    s.source.requestSweep();
    await s.idle();
    expect(
      s.store.connection.database
        .prepare(
          "SELECT count(*) AS count FROM router_source_event WHERE event_id LIKE 'dependency:%'",
        )
        .get()?.["count"],
    ).toBe(1);
  },
);
test("item, field, Project, and sub-issue transitions have stable revisions and schema-valid payloads", async () => {
  const s = await setup();
  s.fake.addItem("IT_A", "I_A");
  s.fake.items.get("IT_A")!.fieldValues.nodes.push({
    text: "Example",
    field: { id: "F_text", name: "Label", dataType: "TEXT" },
  });
  s.source.requestSweep();
  await s.idle();
  const itemDelivery = (id: string) =>
    s.source.receive(
      signedDelivery(
        "projects_v2_item",
        { projects_v2_item: { node_id: "IT_A", project_node_id: "P_one" } },
        id,
      ),
    );
  s.fake.items.get("IT_A")!.fieldValues.nodes[0]!["text"] = "Updated";
  itemDelivery("field");
  await s.idle();
  s.fake.items.get("IT_A")!.fieldValues.nodes = [];
  itemDelivery("clear-field");
  await s.idle();
  s.fake.items.get("IT_A")!.isArchived = true;
  itemDelivery("archive");
  await s.idle();
  s.fake.items.get("IT_A")!.isArchived = false;
  itemDelivery("restore");
  await s.idle();
  s.fake.subIssues.push(["I_A", "I_B"]);
  s.source.requestSweep();
  await s.idle();
  s.fake.subIssues.length = 0;
  s.source.receive(
    signedDelivery("sub_issues", { parent_issue: { node_id: "I_A" } }, "sub-remove"),
  );
  await s.idle();
  s.fake.project.closed = true;
  s.source.receive(
    signedDelivery("projects_v2", { projects_v2: { node_id: "P_one" } }, "project-close"),
  );
  await s.idle();
  s.fake.project.closed = false;
  s.source.receive(
    signedDelivery("projects_v2", { projects_v2: { node_id: "P_one" } }, "project-open"),
  );
  await s.idle();
  s.fake.items.delete("IT_A");
  itemDelivery("remove");
  await s.idle();
  expect(s.source.trackedIssue("I_A")).toBeUndefined();
  const rows = s.store.connection.database
    .prepare("SELECT payload FROM store_inbox WHERE actor_id=? ORDER BY sequence")
    .all("project")
    .map((row) => JSON.parse(row["payload"] as string));
  expect(rows.map((row: { type: string }) => row.type)).toEqual([
    "github.project-item.added",
    "github.project-item.field-changed",
    "github.project-item.field-changed",
    "github.project-item.archived",
    "github.project-item.restored",
    "github.project.closed",
    "github.project.reopened",
    "github.project-item.removed",
  ]);
  const ajv = new Ajv2020();
  const schema = parse(
    readFileSync(
      new URL("../../../../docs/specifications/github-events.schema.yml", import.meta.url),
      "utf8",
    ),
  );
  ajv.addSchema(schema);
  const valid = ajv.compile({ $ref: `${schema.$id}#/$defs/event` });
  for (const row of s.store.connection.database.prepare("SELECT payload FROM store_inbox").all())
    expect(valid(JSON.parse(row["payload"] as string)), JSON.stringify(valid.errors)).toBe(true);
  expect(s.errors).toEqual([]);
});
test("SIGKILL after a read leaves pending work and restart publishes the change once", async () => {
  const s = await setup();
  s.fake.addItem("IT_A", "I_A");
  s.source.requestSweep();
  await s.idle();
  await s.source.stop();
  s.fake.issues.get("I_A")!.state = "CLOSED";
  const { spawn } = await import("node:child_process");
  const child = spawn(
    process.execPath,
    [
      new URL("./test-fixtures/fault-process.ts", import.meta.url).pathname,
      s.path,
      s.fake.url,
      s.options.configuration.owners.sample.hooks[0]!.secretFile,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  cleanup.push(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
    }
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const [code, signal] = await once(child, "exit");
  expect({ code, signal }, stderr).toEqual({ code: null, signal: "SIGKILL" });
  expect(
    s.store.connection.database
      .prepare("SELECT count(*) AS count FROM github_pending WHERE kind='issue'")
      .get()?.["count"],
  ).toBe(1);
  expect(s.source.trackedIssue("I_A")?.issue.state).toBe("open");
  const resumed = startGitHubSource(s.options);
  cleanup.push(() => resumed.stop());
  await s.idle();
  expect(resumed.trackedIssue("I_A")?.issue.state).toBe("closed");
  resumed.requestSweep();
  await s.idle();
  expect(
    s.store.connection.database
      .prepare("SELECT count(*) AS count FROM router_source_event WHERE event_id='issue:I_A:1'")
      .get()?.["count"],
  ).toBe(1);
  expect(
    s.taken.filter(
      (e) => e.actor === "I_A" && (e.payload as { type: string }).type === "github.issue.closed",
    ),
  ).toHaveLength(1);
});
test("a publication failure rolls back the mirror and its pending completion", async () => {
  const s = await setup();
  s.fake.addItem("IT_A", "I_A");
  s.source.requestSweep();
  await s.idle();
  s.store.connection.database.exec(
    "CREATE TRIGGER fail_github_publish BEFORE INSERT ON router_source_event WHEN NEW.event_id LIKE 'dependency:%' BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END",
  );
  s.fake.dependencies.push(["I_A", "I_X"]);
  s.source.receive(signedDelivery("issue_dependencies", { blocked_issue: { node_id: "I_A" } }));
  await expect.poll(() => s.errors.length).toBe(1);
  expect(s.source.trackedIssue("I_A")?.blockedBy).toEqual([]);
  expect(
    s.store.connection.database.prepare("SELECT count(*) AS count FROM github_pending").get()?.[
      "count"
    ],
  ).toBe(1);
  s.store.connection.database.exec("DROP TRIGGER fail_github_publish");
  s.clock.advance(60000);
  await s.idle();
  expect(s.source.trackedIssue("I_A")?.blockedBy.map((i) => i.nodeId)).toEqual(["I_X"]);
});
test("HTTP acknowledges only committed deliveries and maps typed failures", async () => {
  const s = await setup();
  await s.idle();
  const valid = signedDelivery("ping", {});
  expect((await fetch(s.url, { method: "GET" })).status).toBe(405);
  expect(
    (await fetch(s.url, { method: "POST", headers: valid.headers, body: valid.body })).status,
  ).toBe(202);
  expect(
    s.store.connection.database.prepare("SELECT delivery_id FROM github_delivery").get()?.[
      "delivery_id"
    ],
  ).toBe("delivery-one");
  expect(
    (await fetch(s.url, { method: "POST", headers: valid.headers, body: valid.body })).status,
  ).toBe(200);
  expect((await fetch(s.url, { method: "POST", headers: valid.headers, body: "{ }" })).status).toBe(
    401,
  );
  const bad = signedDelivery("issues", {});
  expect(
    (await fetch(s.url, { method: "POST", headers: bad.headers, body: bad.body })).status,
  ).toBe(400);
  const unknown = signedDelivery("ping", {}, "unknown", "9");
  expect(
    (await fetch(s.url, { method: "POST", headers: unknown.headers, body: unknown.body })).status,
  ).toBe(404);
});
test("REDACTED item content is skipped without publishing a removal", async () => {
  const s = await setup();
  s.fake.addItem("IT_A", "I_A");
  s.source.requestSweep();
  await s.idle();
  s.fake.items.get("IT_A")!.type = "REDACTED";
  s.source.receive(
    signedDelivery("projects_v2_item", {
      projects_v2_item: { node_id: "IT_A", project_node_id: "P_one" },
    }),
  );
  await s.idle();
  expect(s.source.trackedIssue("I_A")?.issue.nodeId).toBe("I_A");
  s.source.requestSweep();
  await s.idle();
  expect(s.source.trackedIssue("I_A")?.issue.nodeId).toBe("I_A");
  expect(
    s.taken.some((e) => (e.payload as { type: string }).type === "github.project-item.removed"),
  ).toBe(false);
});
test("redelivery ignores accepted GUIDs and GUIDs with a successful attempt, and asks once before an arrival", async () => {
  const s = await setup();
  await s.idle();
  s.fake.setTarget(undefined);
  s.source.receive(signedDelivery("ping", {}, "accepted"));
  for (const [id, guid, status] of [
    [1, "accepted", 502],
    [2, "succeeded", 502],
    [3, "succeeded", 202],
    [4, "missing", 502],
  ] as const)
    s.fake.deliveries.push({
      id,
      guid,
      status_code: status,
      delivered_at: new Date(s.clock.now() + 1).toISOString(),
      event: "ping",
      payload: {},
    });
  s.clock.advance(59999);
  await new Promise((resolve) => setImmediate(resolve));
  expect(s.fake.redeliveries).toEqual([]);
  s.clock.advance(1);
  await expect.poll(() => s.fake.redeliveries).toEqual([4]);
  await expect
    .poll(
      () =>
        s.store.connection.database
          .prepare("SELECT count(*) AS count FROM github_redelivery")
          .get()?.["count"],
    )
    .toBe(1);
  s.clock.advance(60000);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(s.fake.redeliveries).toEqual([4]);
  expect(s.errors).toEqual([]);
});
test("invalid API node ids leave the mirror unchanged and work pending", async () => {
  const s = await setup();
  s.fake.addItem("IT_A", "I_A");
  s.source.requestSweep();
  await s.idle();
  s.fake.issues.get("I_X")!.id = "I.bad";
  s.fake.dependencies.push(["I_A", "I_X"]);
  s.source.receive(signedDelivery("issues", { issue: { node_id: "I_A" } }));
  await expect.poll(() => s.errors.length).toBe(1);
  expect(s.errors[0]?.kind).toBe("api");
  expect(s.source.trackedIssue("I_A")?.blockedBy).toEqual([]);
});
test("invalid REST delivery rows fail before any redelivery request", async () => {
  const s = await setup();
  await s.idle();
  s.fake.setTarget(undefined);
  s.fake.deliveries.push({
    id: 1,
    guid: "",
    delivered_at: new Date(s.clock.now() + 1).toISOString(),
    status_code: 502,
    event: "ping",
    payload: {},
  });
  s.clock.advance(60000);
  await expect.poll(() => s.errors.length).toBe(1);
  expect(s.errors[0]?.kind).toBe("api");
  expect(s.fake.redeliveries).toEqual([]);
});
test("HTTP rejects bodies beyond the GitHub payload limit without recording a delivery", async () => {
  const s = await setup();
  await s.idle();
  const response = await fetch(s.url, { method: "POST", body: Buffer.alloc(26214401) });
  expect(response.status).toBe(413);
  expect(
    s.store.connection.database.prepare("SELECT count(*) AS count FROM github_delivery").get()?.[
      "count"
    ],
  ).toBe(0);
});

test.each([undefined, "records"])(
  "hook delivery scans and redelivery obey REST parameters for repository %s",
  async (repository) => {
    const s = await setup();
    await s.idle();
    (
      s.options.configuration.owners.sample.hooks[0]! as { repository: string | undefined }
    ).repository = repository;
    s.fake.setTarget(undefined);
    for (let index = 0; index < 101; index++)
      s.fake.deliveries.push({
        id: index + 1,
        guid: `guid-${index}`,
        delivered_at: new Date(s.clock.now() + 101 - index).toISOString(),
        status_code: index === 100 ? 502 : 200,
        event: "ping",
        payload: {},
      });
    s.clock.advance(60000);
    await expect.poll(() => s.fake.redeliveries).toEqual([101]);
    expect(s.fake.deliveryRequests.map((url) => url.searchParams.get("cursor"))).toEqual([
      null,
      "second",
    ]);
    expect(s.fake.deliveryRequests.every((url) => !url.searchParams.has("page"))).toBe(true);
    expect(
      s.fake.deliveryRequests.every(
        (url) =>
          url.pathname ===
          (repository
            ? "/repos/sample/records/hooks/1/deliveries"
            : "/orgs/sample/hooks/1/deliveries"),
      ),
    ).toBe(true);
    expect(s.errors).toEqual([]);
  },
);
test("a repeated delivery Link cursor fails the scan instead of looping", async () => {
  const s = await setup();
  await s.idle();
  s.fake.repeatDeliveryCursor();
  for (let index = 0; index < 101; index++)
    s.fake.deliveries.push({
      id: index + 1,
      guid: `guid-${index}`,
      delivered_at: new Date(s.clock.now() + 1).toISOString(),
      status_code: 200,
      event: "ping",
      payload: {},
    });
  s.clock.advance(60000);
  await expect.poll(() => s.errors.length).toBe(1);
  expect(s.errors[0]?.kind).toBe("api");
  expect(s.fake.deliveryRequests).toHaveLength(2);
});
test("an absent issue stays pending and unavailable while other batch issues publish", async () => {
  const s = await setup();
  s.fake.addItem("IT_A", "I_A");
  s.fake.addItem("IT_B", "I_B");
  s.source.requestSweep();
  await s.idle();
  const prior = s.fake.issues.get("I_A")!;
  s.fake.issues.delete("I_A");
  s.fake.issues.get("I_B")!.state = "CLOSED";
  s.source.receive(signedDelivery("issues", { issue: { node_id: "I_A" } }, "absent"));
  s.source.receive(signedDelivery("issues", { issue: { node_id: "I_B" } }, "present"));
  await expect.poll(() => s.source.trackedIssue("I_B")?.issue.state).toBe("closed");
  expect(s.source.trackedIssue("I_A")).toBeUndefined();
  expect(
    s.store.connection.database
      .prepare("SELECT node_id FROM github_pending WHERE kind='issue'")
      .all(),
  ).toEqual([{ node_id: "I_A" }]);
  const reads = s.fake.log.filter((row) => row.operation === "GitHubIssues").length;
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(s.fake.log.filter((row) => row.operation === "GitHubIssues")).toHaveLength(reads);
  s.fake.issues.set("I_A", prior);
  s.clock.advance(60000);
  await s.idle();
  expect(s.source.trackedIssue("I_A")?.issue.state).toBe("open");
  expect(s.errors).toEqual([]);
});
test("timer wakes during a failed reconcile recover work and re-arm both timers", async () => {
  const s = await setup({ sweepIntervalMs: 50, redeliveryIntervalMs: 40 });
  s.fake.addItem("IT_A", "I_A");
  s.source.requestSweep();
  await s.idle();
  const held = s.fake.hold("GitHubIssues");
  s.fake.issues.get("I_A")!.state = "CLOSED";
  s.source.receive(signedDelivery("issues", { issue: { node_id: "I_A" } }));
  await held.reached;
  s.fake.fail(502);
  s.clock.advance(60);
  held.release();
  await expect.poll(() => s.source.trackedIssue("I_A")?.issue.state).toBe("closed");
  await s.idle();
  expect(s.errors.map((error) => error.status)).toEqual([502]);
  expect(s.clock.timers.size).toBe(2);
});
test("issue absence is durable across restart and becomes available only after a complete read", async () => {
  const s = await setup();
  s.fake.addItem("IT_A", "I_A");
  s.source.requestSweep();
  await s.idle();
  const issue = s.fake.issues.get("I_A")!;
  s.fake.issues.delete("I_A");
  s.source.receive(signedDelivery("issues", { issue: { node_id: "I_A" } }));
  await expect.poll(() => s.source.trackedIssue("I_A")).toBeUndefined();
  await s.source.stop();
  const resumed = startGitHubSource(s.options);
  cleanup.push(() => resumed.stop());
  expect(resumed.trackedIssue("I_A")).toBeUndefined();
  s.fake.issues.set("I_A", issue);
  await s.idle();
  expect(resumed.trackedIssue("I_A")?.issue.state).toBe("open");
});
test("the fresh schema preserves a populated mirror when the source opens", async () => {
  const s = await setup();
  await s.idle();
  const prior = openStore({ path: `${s.path}.prior` });
  const schema = readFileSync(
    new URL("../../../../docs/specifications/github-source-database-schema.sql", import.meta.url),
    "utf8",
  );
  prior.connection.migrate("github", [schema]);
  prior.connection.database
    .prepare(
      "INSERT INTO github_issue(issue_node_id,repository,number,state,state_reason,baselined,revision) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run("I_A", "sample/records", 1, "closed", "completed", 1, 4);
  const source = startGitHubSource({ ...s.options, store: prior, boundProjects: () => [] });
  cleanup.push(async () => {
    await source.stop();
    prior.close();
  });
  expect(
    prior.connection.database
      .prepare("SELECT present,baselined,revision,state FROM github_issue")
      .get(),
  ).toEqual({ present: 1, baselined: 1, revision: 4, state: "closed" });
  expect(
    prior.connection.database
      .prepare("SELECT version FROM schema_migration WHERE owner='github'")
      .get()?.["version"],
  ).toBe(1);
});

test("uses the loaded GitHub section and named installation credential for fetched state", async () => {
  const s = await setup();
  await s.source.stop();
  const api = await apiFixture();
  cleanup.push(() => api.close());
  const directory = mkdtempSync(join(tmpdir(), "github-configuration-"));
  cleanup.push(async () => {
    rmSync(directory, { recursive: true });
  });
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  writeFileSync(join(directory, "key.pem"), privateKey);
  writeFileSync(join(directory, "hook.secret"), "synthetic-secret\n");
  const file = join(directory, "service.yml");
  writeFileSync(
    file,
    stringify({
      store: { file: "state.sqlite" },
      processRepository: { url: s.options.processRepository.url, directory: "clone" },
      credentials: {
        "example-app": {
          kind: "github-app",
          appId: 1,
          installationId: 2,
          privateKeyFile: "key.pem",
          apiUrl: api.url,
        },
      },
      github: {
        apiUrl: s.fake.url,
        owners: {
          sample: { credential: "example-app", hooks: [{ id: 1, secretFile: "hook.secret" }] },
        },
      },
    }),
  );
  const loaded = await loadServiceConfiguration(file);
  const source = startGitHubSource({
    ...s.options,
    configuration: loaded.github,
    credentials: loaded.credentials,
  });
  cleanup.push(() => source.stop());
  s.fake.addItem("IT_A", "I_A");
  source.requestSweep();
  await s.idle();
  expect(source.trackedIssue("I_A")?.issue.state).toBe("open");
  expect(api.calls).toEqual([{ path: "/app/installations/2/access_tokens", body: {} }]);
  expect(s.fake.authorizations.length).toBeGreaterThan(0);
  expect(s.fake.authorizations.every((value) => value === `token ${api.state.token}`)).toBe(true);
  expect(s.errors).toEqual([]);
});

test("discovery follows the committed baseline and enumerates item facts only for tracked issues", async () => {
  const s = await setup();
  s.fake.addItem("IT_A", "I_A");
  s.source.requestSweep();
  await s.idle();
  expect(s.discoveries).toMatchObject([
    { ids: ["I_A"], baselined: { baselined: 1 }, events: { count: 1 } },
  ]);
  expect(s.source.trackedIssueIds()).toEqual(["I_A"]);
  expect(s.source.trackedIssue("I_A")?.items).toEqual([
    {
      project: { nodeId: "P_one", owner: "sample", number: 1 },
      nodeId: "IT_A",
      archived: false,
      fields: {},
    },
  ]);
  const tracked = s.source.trackedIssue("I_A")!;
  expect(tracked.items.map((item) => item.project)).toEqual(tracked.projects);
  s.source.requestSweep();
  await s.idle();
  expect(s.discoveries).toHaveLength(1);
});

test("enumerates two tracked issue node ids in code point order regardless of SQL read order", async () => {
  const s = await setup();
  s.fake.addItem("IT_B", "I_B");
  s.fake.addItem("IT_A", "I_A");
  s.source.requestSweep();
  await s.idle();
  s.store.connection.database.exec("PRAGMA reverse_unordered_selects=ON");
  expect(s.source.trackedIssueIds()).toEqual(["I_A", "I_B"]);
});

test("exports flat item facts in the same order as the issue's Projects", async () => {
  const s = await setup();
  s.fake.addItem("IT_Z", "I_A");
  s.source.requestSweep();
  await s.idle();
  await s.source.stop();
  const db = s.store.connection.database;
  db.prepare(
    "INSERT INTO github_project (project_node_id,owner,number,closed,revision) VALUES (?, ?, ?, ?, ?)",
  ).run("P_two", "sample", 2, 0, 1);
  db.prepare("INSERT INTO github_item VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    "IT_A",
    "P_two",
    "issue",
    "I_A",
    1,
    1,
    1,
  );
  db.prepare("INSERT INTO github_field_value VALUES (?, ?, ?, ?, ?)").run(
    "IT_A",
    "F_track",
    "Track",
    JSON.stringify({ kind: "text", text: "Packages" }),
    1,
  );
  const source = startGitHubSource({
    ...s.options,
    boundProjects: () => [
      { owner: "sample", number: 1 },
      { owner: "sample", number: 2 },
    ],
  });
  cleanup.push(() => source.stop());
  const tracked = source.trackedIssue("I_A")!;
  const expected: readonly import("./index.ts").TrackedItem[] = [
    {
      project: { nodeId: "P_two", owner: "sample", number: 2 },
      nodeId: "IT_A",
      archived: true,
      fields: { Track: { kind: "text", text: "Packages" } },
    },
    {
      project: { nodeId: "P_one", owner: "sample", number: 1 },
      nodeId: "IT_Z",
      archived: false,
      fields: {},
    },
  ];
  expect(tracked.items).toEqual(expected);
  expect(tracked.items.map((item) => item.project)).toEqual(tracked.projects);
});

test("notifies committed mirror changes, including tracking removal and silent absence, but not no-change sweeps", async () => {
  let changes = 0;
  const s = await setup({}, () => {
    changes++;
    const observer = new DatabaseSync(s.path);
    try {
      for (const table of ["github_issue", "github_item", "github_project", "github_dependency"])
        expect(observer.prepare(`SELECT * FROM ${table}`).all()).toEqual(
          s.store.connection.database.prepare(`SELECT * FROM ${table}`).all(),
        );
    } finally {
      observer.close();
    }
  });
  s.fake.addItem("IT_A", "I_A");
  s.fake.addItem("IT_B", "I_B");
  s.source.requestSweep();
  await s.idle();
  expect(changes).toBeGreaterThan(0);
  const initial = changes;
  s.source.requestSweep();
  await s.idle();
  expect(changes).toBe(initial);
  s.fake.items.delete("IT_B");
  s.source.requestSweep();
  await s.idle();
  expect(changes).toBeGreaterThan(initial);
  const removed = changes;
  s.fake.issues.delete("I_A");
  s.source.receive(signedDelivery("issues", { issue: { node_id: "I_A" } }, "absent-notification"));
  await expect.poll(() => s.source.trackedIssue("I_A")).toBeUndefined();
  expect(changes).toBeGreaterThan(removed);
});
test("mirror notifications rerun gate critical paths on a transitive close, tracking removal, and silent absence without member saves", async () => {
  const { createGates, gatesMigrationSteps } = await import("../gates/index.ts");
  const { createComparatorSandbox } = await import("../comparator-sandbox/index.ts");
  const { createLedger, ledgerMigrationSteps, parseLedgerPortfolio } =
    await import("../ledger/index.ts");
  let gates: import("../gates/index.ts").Gates | undefined;
  const s = await setup({}, () => gates?.inputChanged());
  s.fake.addItem("IT_A", "I_A");
  s.fake.addItem("IT_B", "I_B");
  s.fake.addItem("IT_C", "I_C");
  s.fake.dependencies.push(["I_B", "I_A"], ["I_C", "I_B"]);
  s.source.requestSweep();
  await s.idle();
  s.store.connection.migrate("gates", gatesMigrationSteps);
  s.store.connection.migrate("ledger", ledgerMigrationSteps);
  const ledger = createLedger({
    connection: s.store.connection,
    portfolio: parseLedgerPortfolio({ items: [{ id: "left", parent: null }], allocations: [] }),
    now: () => 100,
  });
  const path = "blueprints/parcels/sorting.yml",
    commit = "a".repeat(40),
    key = `${commit}:${path}`;
  const document = {
    schemas: { input: true, output: true, context: true, events: {} },
    machine: {
      states: {
        waiting: { meta: { gate: { comparator: "comparators/order.ts", return: "exit" } } },
      },
    },
  };
  const blueprint = { key, document },
    revision = { commit, read: async () => `export default i=>null;` };
  gates = createGates({
    store: s.store,
    version: async () => ({ status: "loaded", blueprint }),
    revisionAt: async () => revision,
    // Paired service gates expire the ordering comparator at 100 ms.
    sandbox: await createComparatorSandbox({ timeoutMs: 500 }),
    portfolio: {
      ledger,
      current: () => ({ declaration: { ledger: { items: [{ id: "left" }], allocations: [] } } }),
    },
    lintTokens: () => ({ gates: [], configurations: 0, configurationKey: () => "" }),
    trackedIssue: s.source.trackedIssue,
    escalations: {
      raise: () => {
        throw new Error("No traps in this fixture");
      },
      withdraw: () => {},
    },
  });
  cleanup.push(async () => gates!.stop());
  s.store.saveSnapshot({
    actorId: "parcel-waiting",
    machine: key,
    snapshot: {
      status: "active",
      value: "waiting",
      context: { manifold: { issue: "I_A", portfolioItem: "left" } },
    },
  });
  const savedAt = s.store.loadSnapshot("parcel-waiting")!.savedAt;
  await gates.revision({ blueprints: new Map([[path, blueprint]]) }, revision);
  await gates.prepare();
  gates.afterDrain({ schedule: () => {} });
  const length = () =>
    JSON.parse(
      String(
        s.store.connection.database
          .prepare("SELECT input FROM gates_evaluation ORDER BY evaluation_id DESC LIMIT 1")
          .get()?.["input"],
      ),
    ).population[0].criticalPath;
  expect(length()).toBe(3);
  s.fake.issues.get("I_C")!.state = "CLOSED";
  s.source.requestSweep();
  await s.idle();
  await expect.poll(length).toBe(2);
  s.fake.issues.get("I_C")!.state = "OPEN";
  s.source.requestSweep();
  await s.idle();
  await expect.poll(length).toBe(3);
  s.fake.items.delete("IT_C");
  s.source.requestSweep();
  await s.idle();
  await expect.poll(length).toBe(2);
  s.fake.addItem("IT_C", "I_C");
  s.source.requestSweep();
  await s.idle();
  await expect.poll(length).toBe(3);
  const before = s.store.connection.database
    .prepare("SELECT count(*) AS n FROM router_source_event")
    .get()?.["n"];
  s.fake.issues.delete("I_C");
  s.source.receive(signedDelivery("issues", { issue: { node_id: "I_C" } }, "silent-absence"));
  await expect.poll(length).toBe(2);
  expect(
    s.store.connection.database.prepare("SELECT count(*) AS n FROM router_source_event").get()?.[
      "n"
    ],
  ).toBe(before);
  expect(s.store.loadSnapshot("parcel-waiting")!.savedAt).toBe(savedAt);
});

test("title and URL changes update tracked issues without a lifecycle event and remain outside event payloads", async () => {
  const f = await setup();
  f.fake.addItem("IT_A", "I_A");
  f.fake.issues.get("I_A")!.title = "Collect parcel";
  f.fake.issues.get("I_A")!.url = "https://example.test/issues/1";
  await f.idle();
  f.source.requestSweep();
  await f.idle();
  expect(f.source.trackedIssue("I_A")?.issue).toMatchObject({
    title: "Collect parcel",
    url: "https://example.test/issues/1",
  });
  const issueQueries = f.fake.queryLog.filter((query) => query.includes("fragment GitHubIssueRef"));
  expect(issueQueries.length).toBeGreaterThan(0);
  expect(
    issueQueries.every((query) =>
      /fragment GitHubIssueRef on Issue \{ id number title url state/.test(query),
    ),
  ).toBe(true);
  const count = f.taken.length;
  f.fake.issues.get("I_A")!.title = "Deliver parcel";
  f.source.requestSweep();
  await f.idle();
  expect(f.source.trackedIssue("I_A")?.issue.title).toBe("Deliver parcel");
  expect(f.taken).toHaveLength(count);
  f.fake.issues.get("I_A")!.state = "CLOSED";
  f.source.requestSweep();
  await f.idle();
  expect(f.taken).toContainEqual({
    actor: "I_A",
    payload: {
      type: "github.issue.closed",
      blocks: [],
      parent: null,
      issue: {
        nodeId: "I_A",
        repository: "sample/records",
        number: 1,
        state: "closed",
        stateReason: null,
      },
    },
  });
  expect(f.errors).toEqual([]);
});

test("reconciling unchanged issue title and URL twice reports no second mirror change", async () => {
  let changes = 0;
  const f = await setup({}, () => {
    changes++;
  });
  f.fake.addItem("IT_A", "I_A");
  f.fake.issues.get("I_A")!.title = "Collect parcel";
  f.fake.issues.get("I_A")!.url = "https://example.test/issues/1";
  f.source.requestSweep();
  await f.idle();
  expect(f.source.trackedIssue("I_A")?.issue).toMatchObject({
    title: "Collect parcel",
    url: "https://example.test/issues/1",
  });
  expect(changes).toBeGreaterThan(0);
  const firstWrite = changes;
  f.source.requestSweep();
  await f.idle();
  expect(changes).toBe(firstWrite);
  expect(f.errors).toEqual([]);
});

test("redelivery preserves a GitHub attempt id above the safe integer range", async () => {
  const s = await setup();
  await s.idle();
  s.fake.setTarget(undefined);
  const attempt = 9007199254740993n;
  s.fake.deliveries.push({
    id: attempt,
    guid: "large-attempt",
    delivered_at: new Date(s.clock.now()).toISOString(),
    status_code: 502,
    event: "ping",
    payload: {},
  });
  s.clock.advance(60000);
  await expect.poll(() => s.fake.redeliveries).toEqual([attempt]);
  const statement = s.store.connection.database.prepare(
    "SELECT attempt_id FROM github_redelivery WHERE delivery_id=?",
  );
  statement.setReadBigInts(true);
  expect(statement.get("large-attempt")?.["attempt_id"]).toBe(attempt);
  expect(s.errors).toEqual([]);
});
