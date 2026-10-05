// ---
// relationships:
//   verifies: service-assembly
// ---
import * as fs from "node:fs/promises";
import git from "isomorphic-git";
import { stringify } from "yaml";
import { model } from "../intake/test-fixtures/fixture.ts";
import { afterEach, expect, test } from "vite-plus/test";
import { startService, githubWebhookPath } from "./index.ts";
import type { Service, ServiceStep, ServiceLogEntry } from "./index.ts";
import { serviceFixture } from "./test-fixtures/repository.ts";
import { signedDelivery } from "../github-source/test-fixtures/api.ts";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
});
async function fixture() {
  const f = await serviceFixture();
  cleanup.push(f.close);
  return f;
}
const startSteps: ServiceStep[] = [
  "configuration-loaded",
  "store-opened",
  "portfolio-opened",
  "escalations-opened",
  "process-repository-opened",
  "revision-followed",
  "pulled",
  "actor-host-opened",
  "router-started",
  "escalations-started",
  "github-started",
  "intake-started",
  "t3code-started",
  "listening",
];
const stopSteps: ServiceStep[] = [
  "http-closed",
  "sources-stopped",
  "escalations-stopped",
  "revisions-idle",
  "intake-stopped",
  "router-stopped",
  "store-closed",
];
function url(service: Service) {
  const { host, port } = service.http.address();
  return `http://${host}:${port}`;
}
test("starts in order, awaits the actor host, follows revisions, and stops once", async () => {
  const f = await fixture();
  const steps: ServiceStep[] = [];
  const host = {
    start: () => {},
    actorOf: () => undefined,
    followers: () => [],
    followedThreads: () => [],
    issueThreads: () => [],
    eventSchema: () => ({ status: "undeclared" as const }),
    release: async () => {},
    subscription: () => ({ topics: [] }),
    restore: () => ({ status: "held" as const, reason: "test" }),
  };
  const service = await startService({
    configurationFile: f.file,
    log: () => {},
    probes: { step: (step) => steps.push(step) },
    actorHost: async (parts) => {
      expect(parts.revisions.latest()?.commit).toBe(f.first);
      await Promise.resolve();
      return host;
    },
  });
  cleanup.push(service.stop);
  expect(service.actorHost).toBe(host);
  expect(steps).toEqual(startSteps);
  expect(service.portfolio.current().commit).toBe(f.first);
  expect([...service.revisions.latest()!.failures]).toEqual([]);
  expect(service.revisions.latest()?.blueprints.size).toBe(2);
  const endpoint = url(service);
  expect((await fetch(endpoint + "/")).status).toBe(404);
  const stopping = service.stop();
  expect(service.stop()).toBe(stopping);
  await stopping;
  expect(steps).toEqual([...startSteps, ...stopSteps]);
  await expect(fetch(endpoint)).rejects.toThrow();
  expect(() => service.github.receive(signedDelivery("ping", {}))).toThrow(TypeError);
  await expect(service.revisions.follow()).rejects.toThrow(TypeError);
});
test("a signed push on the mounted listener applies a new blueprint and portfolio", async () => {
  const f = await fixture();
  let applied!: (commit: string) => void;
  const commits: string[] = [];
  const service = await startService({
    configurationFile: f.file,
    log: () => {},
    probes: {
      applied: (revision) => {
        commits.push(revision.commit);
        applied?.(revision.commit);
      },
    },
  });
  cleanup.push(service.stop);
  const next = await f.commit(70);
  const reached = new Promise<string>((resolve) => {
    applied = resolve;
  });
  const delivery = signedDelivery("push", {
    ref: "refs/heads/main",
    after: next,
    deleted: false,
    repository: { clone_url: f.remote.url, html_url: f.remote.url },
  });
  expect(
    (
      await fetch(url(service) + githubWebhookPath, {
        method: "POST",
        headers: delivery.headers,
        body: delivery.body,
      })
    ).status,
  ).toBe(202);
  expect(await reached).toBe(next);
  expect(service.revisions.latest()?.commit).toBe(next);
  expect(service.revisions.latest()?.blueprints.get("blueprints/counter.yml")?.version.commit).toBe(
    next,
  );
  expect(service.portfolio.current().commit).toBe(next);
  expect(
    service.portfolio.current().declaration.ledger.allocations.find((a) => a.item === "alpha")
      ?.guarantee,
  ).toBe(70);
  await service.revisions.follow();
  expect(commits).toEqual([f.first, next]);
});
test("abort at a startup boundary unwinds resources without starting sources", async () => {
  const f = await fixture();
  const abort = new AbortController();
  const steps: ServiceStep[] = [];
  await expect(
    startService({
      configurationFile: f.file,
      signal: abort.signal,
      log: () => {},
      probes: {
        step: (step) => {
          steps.push(step);
          if (step === "process-repository-opened") abort.abort();
        },
      },
    }),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(steps).toEqual([...startSteps.slice(0, 5), "escalations-stopped", "store-closed"]);
});

test("restores and drains a populated inbox before sources start", async () => {
  const f = await fixture();
  const { openStore } = await import("../store/index.ts");
  const { mkdir } = await import("node:fs/promises");
  const { join } = await import("node:path");
  await mkdir(join(f.directory, "data"));
  const store = openStore({ path: join(f.directory, "data/state.sqlite") });
  store.saveSnapshot({
    actorId: "counter-one",
    machine: "counter",
    snapshot: { status: "active", value: "counting", context: { count: 1 } },
  });
  store.writeInbox({ eventId: "increment-one", topic: "counter", payload: { type: "increment" } }, [
    "counter-one",
  ]);
  store.close();
  const events: string[] = [];
  const service = await startService({
    configurationFile: f.file,
    log: () => {},
    probes: { step: (step) => events.push(step) },
    actorHost: () => ({
      start: () => {},
      actorOf: () => undefined,
      followers: () => [],
      followedThreads: () => [],
      issueThreads: () => [],
      eventSchema: () => ({ status: "undeclared" }),
      release: async () => {},
      subscription: () => ({ topics: ["counter"] }),
      restore: (stored) => {
        events.push("restored");
        return {
          status: "restored",
          target: {
            actorId: stored.actorId,
            send: () => {
              events.push("drained");
            },
            persist: () => ({
              machine: "counter",
              snapshot: { status: "active", value: "counting", context: { count: 2 } },
            }),
          },
        };
      },
    }),
  });
  cleanup.push(service.stop);
  expect(events.indexOf("restored")).toBeLessThan(events.indexOf("router-started"));
  expect(events.indexOf("drained")).toBeLessThan(events.indexOf("github-started"));
  expect(service.store.pendingInbox("counter-one")).toEqual([]);
  expect(service.store.loadSnapshot("counter-one")?.snapshot["context"]).toEqual({ count: 2 });
});

test("pulls and applies published commits in order before shutdown closes the store", async () => {
  const f = await fixture();
  const commits: string[] = [];
  const steps: ServiceStep[] = [];
  const service = await startService({
    configurationFile: f.file,
    log: () => {},
    probes: { applied: (r) => commits.push(r.commit), step: (s) => steps.push(s) },
  });
  cleanup.push(service.stop);
  await service.github.stop();
  await service.revisions.follow();
  const a = await f.commit(65);
  const current = service.processRepository.current.bind(service.processRepository);
  let release!: () => void;
  let entered!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const reached = new Promise<void>((resolve) => {
    entered = resolve;
  });
  service.processRepository.current = () => {
    const revision = current();
    if (!revision || revision.commit !== a) return revision;
    return {
      ...revision,
      read: async (path) => {
        if (path === "blueprints/counter.yml") {
          entered();
          await blocked;
        }
        return revision.read(path);
      },
    };
  };
  const pullA = service.revisions.pull();
  await reached;
  const b = await f.commit(70);
  const pullB = service.revisions.pull();
  release();
  await Promise.all([pullA, pullB]);
  const c = await f.commit(75);
  await service.revisions.pull();
  expect(commits).toEqual([f.first, a, b, c]);
  const held = f.remote.holdNext();
  const d = await f.commit(80);
  const pullD = service.revisions.pull();
  await held.reached;
  const stopping = service.stop();
  await expect.poll(() => steps.includes("sources-stopped")).toBe(true);
  expect(steps).not.toContain("store-closed");
  held.release();
  await pullD;
  expect(service.portfolio.current().commit).toBe(d);
  await stopping;
  expect(steps.at(-1)).toBe("store-closed");
});

test("a failed revision read is retried before the next pull can advance current", async () => {
  const f = await fixture();
  const events: string[] = [];
  const service = await startService({
    configurationFile: f.file,
    log: () => {},
    probes: {
      applied: (r) => events.push(`applied:${r.commit}`),
      pull: (step, commit) => {
        if (step === "published") events.push(`published:${commit}`);
      },
    },
  });
  cleanup.push(service.stop);
  await service.github.stop();
  await service.revisions.follow();
  const a = await f.commit(65);
  const current = service.processRepository.current.bind(service.processRepository);
  let fail = true;
  service.processRepository.current = () => {
    const revision = current();
    if (!revision || revision.commit !== a) return revision;
    return {
      ...revision,
      read: async (path) => {
        if (fail && path === "blueprints/counter.yml") {
          fail = false;
          throw new Error("synthetic read failure");
        }
        return revision.read(path);
      },
    };
  };
  await expect(service.revisions.pull()).rejects.toThrow("synthetic read failure");
  expect(events).not.toContain(`applied:${a}`);
  const b = await f.commit(70);
  await service.revisions.pull();
  expect(events.indexOf(`applied:${a}`)).toBeLessThan(events.indexOf(`published:${b}`));
  expect(events.filter((e) => e.startsWith("applied:"))).toEqual([
    `applied:${f.first}`,
    `applied:${a}`,
    `applied:${b}`,
  ]);
});

test("stop drains a fire-and-forget signed push pull before closing the store", async () => {
  const f = await fixture();
  let fetched = 0;
  let swept!: () => void;
  const sweepFetched = new Promise<void>((resolve) => {
    swept = resolve;
  });
  const steps: ServiceStep[] = [];
  const service = await startService({
    configurationFile: f.file,
    log: () => {},
    probes: {
      pull: (step) => {
        if (step === "fetched" && ++fetched === 2) swept();
      },
      step: (step) => steps.push(step),
    },
  });
  cleanup.push(service.stop);
  await sweepFetched;
  await service.revisions.follow();
  const next = await f.commit(70);
  const held = f.remote.holdNext();
  const delivery = signedDelivery("push", {
    ref: "refs/heads/main",
    deleted: false,
    after: next,
    repository: { clone_url: f.remote.url, html_url: f.remote.url },
  });
  const response = await fetch(url(service) + githubWebhookPath, {
    method: "POST",
    headers: delivery.headers,
    body: delivery.body,
  });
  expect(response.status).toBe(202);
  await held.reached;
  const stopping = service.stop();
  try {
    await expect.poll(() => steps.includes("sources-stopped")).toBe(true);
    expect(steps).not.toContain("store-closed");
  } finally {
    held.release();
  }
  await stopping;
  expect(service.portfolio.current().commit).toBe(next);
});

test("stop continues through a failed step and rejects after closing the store", async () => {
  const f = await fixture();
  const steps: ServiceStep[] = [];
  const failure = new Error("synthetic stop probe failure");
  const service = await startService({
    configurationFile: f.file,
    log: () => {},
    probes: {
      step: (step) => {
        steps.push(step);
        if (step === "sources-stopped") throw failure;
      },
    },
  });
  await expect(service.stop()).rejects.toBe(failure);
  expect(steps.slice(-stopSteps.length)).toEqual(stopSteps);
});

test("the default actor host holds restored actors with their inbox intact", async () => {
  const f = await fixture();
  const first = await startService({ configurationFile: f.file, log: () => {} });
  first.store.saveSnapshot({
    actorId: "counter-one",
    machine: "counter",
    snapshot: { status: "active", value: "counting", context: { count: 1 } },
  });
  first.store.writeInbox(
    { eventId: "increment-one", topic: "counter", payload: { type: "increment" } },
    ["counter-one"],
  );
  await first.stop();
  const held: string[] = [];
  const service = await startService({
    configurationFile: f.file,
    log: (entry) => {
      if (entry.event === "actor-held") held.push(entry.message);
    },
  });
  cleanup.push(service.stop);
  expect(held).toEqual([expect.stringContaining("blueprint version counter is missing (file)")]);
  expect(service.store.pendingInbox("counter-one")).toHaveLength(1);
  expect(
    service.actorHost.subscription({
      actorId: "counter-one",
      machine: "counter",
      snapshot: { status: "active", value: "counting" },
    }),
  ).toEqual({ topics: [] });
});

test("the default host starts durable actors and restores them before sources start", async () => {
  const f = await fixture();
  const service = await startService({ configurationFile: f.file, log: () => {} });
  cleanup.push(service.stop);
  const blueprint = service.revisions.latest()!.blueprints.get("blueprints/counter.yml")!;
  service.actorHost.start({
    actorId: "parcel",
    blueprint,
    input: { manifold: { issue: "parcel-node" } },
  });
  expect(service.store.loadSnapshot("parcel")?.snapshot["entries"]).toMatchObject({ count: 2 });
  await service.stop();
  const steps: ServiceStep[] = [];
  const resumed = await startService({
    configurationFile: f.file,
    log: () => {},
    probes: { step: (step) => steps.push(step) },
  });
  cleanup.push(resumed.stop);
  expect(resumed.actorHost.actorOf("parcel")).toEqual({
    manifold: { issue: "parcel-node" },
    commit: f.first,
  });
  expect(resumed.store.loadSnapshot("parcel")?.snapshot["entries"]).toMatchObject({ count: 2 });
  expect(steps.indexOf("actor-host-opened")).toBeLessThan(steps.indexOf("router-started"));
});

test("passes the service lint bound to revision loading and reports warnings", async () => {
  const f = await fixture();
  const { writeFile } = await import("node:fs/promises");
  const { stringify } = await import("yaml");
  const commit = await f.commit(
    60,
    {},
    {
      machine: {
        initial: "queued",
        states: {
          queued: {
            meta: { gate: { comparator: "comparators/order.ts", return: { state: "returned" } } },
            on: { token: "broken" },
          },
          broken: {},
          returned: {},
          done: { type: "final" },
        },
      },
      schemas: { input: true, output: true, context: true, events: {} },
    },
  );
  await writeFile(
    f.file,
    stringify({ ...f.configuration, blueprintLint: { configurationBound: 1 } }),
  );
  const entries: import("./types.ts").ServiceLogEntry[] = [];
  const service = await startService({
    configurationFile: f.file,
    log: (entry) => entries.push(entry),
  });
  cleanup.push(service.stop);
  expect(service.configuration.blueprintLint.configurationBound).toBe(1);
  expect(service.revisions.latest()?.commit).toBe(commit);
  expect(
    service.revisions.latest()?.blueprints.get("blueprints/counter.yml")?.tokens.gates[0]?.verdict,
  ).toBe("unknown");
  expect(entries).toContainEqual(
    expect.objectContaining({
      level: "warn",
      event: "blueprint-warnings",
      detail: expect.objectContaining({
        warnings: [expect.objectContaining({ kind: "token-unknown" })],
      }),
    }),
  );
});

test("service retry uses the actor host to load the corrected version and drain its held inbox", async () => {
  const f = await fixture();
  await f.commit(
    60,
    {},
    {
      machine: {
        initial: "waiting",
        states: { waiting: { on: { scanned: "delivered" } }, delivered: { type: "final" } },
      },
      schemas: { input: true, output: true, context: true, events: { scanned: true } },
    },
  );
  const seed = await startService({ configurationFile: f.file, log: () => {} });
  const blueprint = seed.revisions.latest()!.blueprints.get("blueprints/counter.yml")!;
  seed.actorHost.start({
    actorId: "parcel",
    blueprint,
    input: { manifold: { issue: "parcel-node" } },
  });
  const valid = seed.store.loadSnapshot("parcel")!;
  seed.router.stop();
  seed.store.saveSnapshot({ ...valid, machine: "missing-version" });
  seed.store.writeInbox(
    { eventId: "scan-one", topic: "github.issue.parcel-node", payload: { type: "scanned" } },
    ["parcel"],
  );
  await seed.stop();
  const service = await startService({ configurationFile: f.file, log: () => {} });
  cleanup.push(service.stop);
  const escalation = service.escalations.list({ status: "open" })[0]!;
  expect(escalation.raiser).toMatchObject({
    type: "service",
    kind: "held-actor",
    subject: { actorId: "parcel" },
  });
  expect(service.store.pendingInbox("parcel")).toHaveLength(1);
  service.store.saveSnapshot(valid);
  const path = url(service) + "/api/escalations/" + escalation.id + "/answer";
  const headers = { "Content-Type": "application/json" };
  expect(
    (await fetch(path, { method: "POST", headers, body: JSON.stringify({ choice: "retry" }) }))
      .status,
  ).toBe(200);
  await expect.poll(() => service.store.pendingInbox("parcel").length).toBe(0);
  expect(service.store.loadSnapshot("parcel")?.snapshot).toMatchObject({
    status: "done",
    value: "delivered",
  });
  expect(service.escalations.list({ status: "open" })).toEqual([]);
  expect(
    (await fetch(path, { method: "POST", headers, body: JSON.stringify({ choice: "dismiss" }) }))
      .status,
  ).toBe(200);
  expect(service.store.loadSnapshot("parcel")?.snapshot).toMatchObject({
    status: "done",
    value: "delivered",
  });
});

test("the service registry loads escalate blueprints and their callbacks answer through the HTTP host", async () => {
  const f = await fixture();
  const { escalationContractSchema } = await import("@wyrd-company/manifold-shared");
  await f.commit(
    60,
    {},
    {
      machine: {
        id: "parcel",
        initial: "asking",
        states: {
          asking: {
            invoke: {
              id: "ask",
              src: "escalate",
              input: { question: "Send the parcel?", freeText: true },
            },
            on: { "escalation.answered": "delivered", skipped: "delivered" },
          },
          delivered: { type: "final" },
        },
      },
      schemas: {
        input: true,
        context: true,
        output: true,
        actors: {
          escalate: {
            input: { $ref: escalationContractSchema.$id + "#/$defs/escalate-input" },
            output: true,
          },
        },
        events: {
          skipped: true,
          "escalation.answered": {
            $ref: escalationContractSchema.$id + "#/$defs/escalation-answered-event",
          },
        },
      },
    },
  );
  const service = await startService({ configurationFile: f.file, log: () => {} });
  cleanup.push(service.stop);
  const revision = service.revisions.latest()!;
  expect([...revision.failures]).toEqual([]);
  const blueprint = revision.blueprints.get("blueprints/counter.yml")!;
  service.actorHost.start({ actorId: "parcel", blueprint, input: {} });
  const escalation = service.escalations.list({ status: "open" })[0]!;
  expect(escalation.raiser).toEqual({
    type: "blueprint",
    actorId: "parcel",
    invokeId: "ask",
    entryId: "2",
  });
  expect(escalation.question).toBe("Send the parcel?");
  const response = await fetch(url(service) + "/api/escalations/" + escalation.id + "/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Proceed" }),
  });
  expect(response.status).toBe(200);
  await expect.poll(() => service.store.loadSnapshot("parcel")?.snapshot.status).toBe("done");
  expect(service.escalations.get(escalation.id)?.answer?.value).toEqual({ text: "Proceed" });
  expect(
    service.store.connection.database
      .prepare("SELECT taken_at FROM escalation WHERE escalation_id=?")
      .get(escalation.id)?.["taken_at"],
  ).toEqual(expect.any(Number));
  service.actorHost.start({
    actorId: "envelope",
    blueprint,
    input: { manifold: { issue: "envelope-node" } },
  });
  const withdrawn = service.escalations.list({ status: "open" })[0]!;
  service.router.publish({
    source: "github",
    eventId: "skip-one",
    topics: ["github.issue.envelope-node"],
    event: { type: "skipped" },
  });
  await expect.poll(() => service.store.loadSnapshot("envelope")?.snapshot.status).toBe("done");
  expect(service.escalations.get(withdrawn.id)?.status).toBe("withdrawn");
});

test("service startup starts ntfy delivery and shutdown aborts it before closing the store", async () => {
  const f = await fixture();
  const { serve, readRequest } = await import("../escalations/test-support.ts");
  const { writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { stringify } = await import("yaml");
  let published = 0;
  let bearer: string | undefined;
  let requestClosed = false;
  const ntfy = await serve((req, res) => {
    void readRequest(req).then((body) => {
      expect(JSON.parse(body)).toMatchObject({ topic: "opaque-topic" });
      bearer = req.headers.authorization;
      published++;
      res.on("close", () => {
        requestClosed = true;
      });
    });
  });
  cleanup.push(ntfy.close);
  await writeFile(join(f.directory, "publisher.token"), "synthetic-publisher-token");
  await writeFile(
    f.file,
    stringify({
      ...f.configuration,
      credentials: {
        ...f.configuration.credentials,
        publisher: { kind: "ntfy-token", tokenFile: "publisher.token" },
      },
      escalations: {
        publicUrl: "https://example.test",
        destinations: {
          default: {
            server: ntfy.url,
            topic: "opaque-topic",
            posture: "open",
            credential: "publisher",
          },
        },
      },
    }),
  );
  const service = await startService({ configurationFile: f.file, log: () => {} });
  cleanup.push(service.stop);
  service.escalations.raise({
    kind: "held-actor",
    subject: { actorId: "parcel" },
    question: "Try delivery again?",
    choices: [{ id: "retry", label: "Retry" }],
  });
  await expect.poll(() => published).toBe(1);
  expect(bearer).toBe("Bearer synthetic-publisher-token");
  await service.stop();
  await expect.poll(() => requestClosed).toBe(true);
  expect(() => service.store.connection.database.prepare("SELECT 1")).toThrow();
});

async function publishIntake(
  f: Awaited<ReturnType<typeof serviceFixture>>,
  expression = '{"blueprint":"blueprints/counter.yml","portfolioItem":"alpha"}',
) {
  const parent = await git.resolveRef({ fs, gitdir: f.remote.gitdir, ref: "refs/heads/main" });
  const { commit } = await git.readCommit({ fs, gitdir: f.remote.gitdir, oid: parent });
  const { tree } = await git.readTree({ fs, gitdir: f.remote.gitdir, oid: commit.tree });
  async function blob(path: string, value: unknown) {
    return {
      path,
      mode: "100644",
      type: "blob" as const,
      oid: await git.writeBlob({
        fs,
        gitdir: f.remote.gitdir,
        blob: Buffer.from(stringify(value)),
      }),
    };
  }
  const models = await git.writeTree({
    fs,
    gitdir: f.remote.gitdir,
    tree: [await blob("quote.yml", model(expression))],
  });
  const next = await git.writeTree({
    fs,
    gitdir: f.remote.gitdir,
    tree: [
      ...tree.filter((entry) => !["bindings.yml", "manifold.yml", "models"].includes(entry.path)),
      await blob("bindings.yml", {
        githubProjects: {
          first: { owner: "sample", number: 1, environment: "env-one", item: "alpha" },
        },
      }),
      await blob("manifold.yml", { intake: { decisionModel: "models/quote.yml" } }),
      { path: "models", mode: "040000", type: "tree", oid: models },
    ],
  });
  const oid = await git.writeCommit({
    fs,
    gitdir: f.remote.gitdir,
    commit: { ...commit, tree: next, parent: [parent], message: "Example intake declaration" },
  });
  await f.remote.force(oid);
  return oid;
}

test("wires discovery, revision retry, actor start and drained shutdown through service parts", async () => {
  const f = await fixture();
  await publishIntake(f, '{"blueprint":"blueprints/counter.yml","portfolioItem":"unknown"}');
  f.api.addItem("IT_A", "I_A");
  const logs: { event: string; message: string }[] = [];
  const steps: ServiceStep[] = [];
  const service = await startService({
    configurationFile: f.file,
    log: (entry) => logs.push(entry),
    probes: { step: (step) => steps.push(step) },
  });
  cleanup.push(service.stop);
  await expect.poll(() => service.intake.record("I_A")?.status).toBe("failed");
  expect(service.intake.record("I_A")?.failure?.detail).toEqual({ item: "unknown" });
  expect(logs).toContainEqual(
    expect.objectContaining({ event: "intake-failed", message: "Intake failed: item-unknown" }),
  );
  expect(service.actorHost.actorOf("task:I_A")).toBeUndefined();
  const next = await publishIntake(f);
  await service.revisions.pull();
  await service.intake.idle();
  expect(service.intake.record("I_A")).toMatchObject({
    status: "started",
    commit: next,
    attempts: 2,
  });
  expect(service.store.loadSnapshot("task:I_A")?.snapshot["context"]).toMatchObject({
    manifold: { issue: "I_A", project: "P_one", environment: "env-one", portfolioItem: "alpha" },
  });
  f.api.addItem("IT_B", "I_B");
  service.github.requestSweep();
  await expect.poll(() => service.intake.record("I_B")?.status).toBe("started");
  expect(service.actorHost.actorOf("task:I_A")).toMatchObject({
    commit: next,
    manifold: { issue: "I_A" },
  });
  expect(service.actorHost.actorOf("task:I_B")).toMatchObject({
    commit: next,
    manifold: { issue: "I_B" },
  });
  expect(service.store.activeSnapshots()).toHaveLength(2);
  expect(steps.indexOf("actor-host-opened")).toBeLessThan(steps.indexOf("intake-started"));
  await service.stop();
  expect(() => service.intake.discovered(["I_C"])).toThrow(TypeError);
});

test("wires gates into revision following, router resume, and shutdown", async () => {
  const f = await fixture();
  const events: string[] = [];
  const gates = {
    revision: async (
      load: { blueprints: ReadonlyMap<string, unknown> },
      revision: { commit: string },
    ) => {
      expect(load.blueprints.size).toBe(2);
      events.push(`gate-revision:${revision.commit}`);
    },
    prepare: async () => {
      events.push("gate-prepare");
    },
    afterDrain: () => {
      events.push("gate-drain");
    },
    saved: () => {},
    comparatorFailed: () => undefined,
    strandedToken: () => undefined,
    inputChanged: () => {
      events.push("gate-input");
    },
    replay: async () => {
      throw new Error("unused");
    },
    tokenHolder: () => undefined,
    stop: () => {
      events.push("gate-stop");
    },
  };
  const service = await startService({
    configurationFile: f.file,
    log: () => {},
    gates: (parts) => {
      expect(
        parts.store.connection.database
          .prepare("SELECT version FROM schema_migration WHERE owner = 'gates'")
          .get(),
      ).toEqual({ version: 1 });
      return gates;
    },
    actorHost: (parts) => {
      expect(parts.gates).toBe(gates);
      events.push("host-created");
      return {
        start: () => {},
        actorOf: () => undefined,
        followers: () => [],
        followedThreads: () => [],
        issueThreads: () => [],
        eventSchema: () => ({ status: "undeclared" }),
        release: async () => {},
        subscription: () => ({ topics: [] }),
        restore: () => ({ status: "held", reason: "test" }),
      };
    },
    probes: { step: (step) => events.push(step) },
  });
  cleanup.push(service.stop);
  expect(service.gates).toBe(gates);
  expect(events.indexOf(`gate-revision:${f.first}`)).toBeLessThan(events.indexOf("gate-prepare"));
  expect(events.indexOf("gate-prepare")).toBeLessThan(events.indexOf("host-created"));
  expect(events).toContain("gate-drain");
  expect(events.filter((event) => event === "gate-input")).toHaveLength(1);
  expect(events.indexOf("gate-drain")).toBeLessThan(events.indexOf("router-started"));
  const next = await f.commit(70);
  await service.revisions.pull();
  expect(events.filter((event) => event.startsWith("gate-revision:"))).toEqual([
    `gate-revision:${f.first}`,
    `gate-revision:${next}`,
  ]);
  expect(events.filter((event) => event === "gate-input")).toHaveLength(2);
  await service.stop();
  expect(events.indexOf("revisions-idle")).toBeLessThan(events.indexOf("gate-stop"));
  expect(events.indexOf("gate-stop")).toBeLessThan(events.indexOf("store-closed"));
});

test("default service resumes gates with real token lint, save hooks, and escalation answers", async () => {
  const f = await fixture();
  await f.commit(
    60,
    { comparator: "export default i => i.holders.length ? null : { task: i.population[0].id };" },
    {
      machine: {
        initial: "counting",
        context: {},
        states: {
          counting: {
            meta: { gate: { comparator: "order.ts", return: { state: "packed" } } },
            on: { token: "holding" },
          },
          holding: { on: { finish: "done" } },
          packed: {},
          done: { type: "final" },
        },
      },
      schemas: { input: true, output: true, context: true, events: { token: true, finish: true } },
    },
  );
  const first = await startService({ configurationFile: f.file, log: () => {} });
  cleanup.push(first.stop);
  const blueprint = first.revisions.latest()!.blueprints.get("blueprints/counter.yml")!;
  expect(blueprint.tokens.gates[0]?.verdict).toBe("potential");
  first.gates!.stop();
  const { createActor } = await import("xstate");
  const actor = createActor(blueprint.machine);
  actor.start();
  for (let i = 0; i < 20; i++)
    first.store.saveSnapshot({
      actorId: `parcel-${String(i).padStart(2, "0")}`,
      machine: blueprint.key,
      snapshot: actor.getPersistedSnapshot() as import("../store/index.ts").PersistedSnapshot,
    });
  actor.stop();
  await first.stop();
  const resumed = await startService({ configurationFile: f.file, log: () => {} });
  cleanup.push(resumed.stop);
  expect(resumed.store.loadSnapshot("parcel-00")?.snapshot["value"]).toBe("holding");
  expect(resumed.store.pendingInbox("parcel-00")).toEqual([]);
  await resumed.github.stop();
  await resumed.t3code.stop();
  await resumed.revisions.follow();
  // Drain host persistence and the gate passes those saves schedule.
  for (let turn = 0; turn < 4; turn++) await new Promise<void>((resolve) => setImmediate(resolve));
  const question = resumed.escalations
    .list({ status: "open" })
    .find((row) => row.raiser.type === "service" && row.raiser.kind === "stranded-token")!;
  expect(question).toBeDefined();
  expect(resumed.escalations.answer(question.id, { choice: "return" }, "api").status).toBe(
    "answered",
  );
  await expect
    .poll(
      () =>
        resumed.store.connection.database.prepare("SELECT count(*) AS n FROM gates_token").get()?.[
          "n"
        ],
    )
    .toBe(2);
  expect(
    resumed.store.connection.database
      .prepare("SELECT return_reason FROM gates_token WHERE actor_id='parcel-00'")
      .get()?.["return_reason"],
  ).toBe("escalation");
  expect(resumed.store.loadSnapshot("parcel-01")?.snapshot["value"]).toBe("holding");
});

test("retries failed intake through a committed GitHub mirror change on the same revision", async () => {
  const f = await fixture();
  const commit = await publishIntake(
    f,
    'task.issue.state = "open" ? {"blueprint":"missing.yml"} : {"blueprint":"blueprints/counter.yml","portfolioItem":"alpha"}',
  );
  f.api.addItem("IT_A", "I_A");
  const service = await startService({ configurationFile: f.file, log: () => {} });
  cleanup.push(service.stop);
  await expect.poll(() => service.intake.record("I_A")?.status).toBe("failed");
  const escalation = service.escalations
    .list({ status: "open" })
    .find((e) => e.raiser.type === "service" && e.raiser.kind === "intake-failed")!;
  expect(escalation.raiser).toMatchObject({ subject: { issue: "I_A" } });
  service.escalations.answer(escalation.id, { choice: "retry" }, "api");
  await service.intake.idle();
  expect(service.intake.record("I_A")?.attempts).toBe(2);
  f.api.issues.get("I_A")!.state = "CLOSED";
  service.github.requestSweep();
  await expect.poll(() => service.intake.record("I_A")?.status).toBe("started");
  expect(service.intake.record("I_A")).toMatchObject({ commit, attempts: 3 });
  expect(service.store.activeSnapshots()).toHaveLength(1);
  expect(service.escalations.list({ status: "open" })).toEqual([]);
});

test("logs portfolio warnings once per applied revision for applied, unchanged and rejected portfolios", async () => {
  const f = await fixture();
  const logs: ServiceLogEntry[] = [];
  const service = await startService({
    configurationFile: f.file,
    log: (entry) => logs.push(entry),
  });
  cleanup.push(service.stop);
  const warnings = () => logs.filter((entry) => entry.event === "portfolio-warnings");
  expect(warnings()).toHaveLength(1);
  expect(warnings()[0]).toMatchObject({
    level: "warn",
    detail: {
      commit: f.first,
      warnings: [
        {
          file: "portfolio",
          location: "/items/alpha/allocations/acct",
          kind: "account-undeclared",
          severity: "warning",
          details: { item: "alpha", account: "acct" },
        },
        {
          file: "portfolio",
          location: "/items/beta/allocations/acct",
          kind: "account-undeclared",
          severity: "warning",
          details: { item: "beta", account: "acct" },
        },
      ],
    },
  });
  await service.revisions.follow();
  expect(warnings()).toHaveLength(1);
  const unchanged = await f.commit(60);
  await service.revisions.pull();
  expect(warnings()).toHaveLength(2);
  expect(warnings()[1]?.detail?.["commit"]).toBe(unchanged);
  expect(
    logs.find(
      (entry) => entry.event === "revision-applied" && entry.detail?.["commit"] === unchanged,
    )?.detail?.["portfolio"],
  ).toBe("unchanged");
  const rejected = await f.commit(40, {
    bindings: {
      t3codeProjects: {
        first: { environment: "env-one", project: "workspace-one", item: "absent" },
      },
    },
  });
  await service.revisions.pull();
  expect(warnings()).toHaveLength(3);
  expect(warnings()[2]?.detail?.["commit"]).toBe(rejected);
  expect(
    logs.find(
      (entry) => entry.event === "portfolio-rejected" && entry.detail?.["commit"] === rejected,
    ),
  ).toBeDefined();
  const declared = await f.commit(40, {
    accounts: {
      accounts: {
        acct: {
          unit: "usd",
          kind: "api",
          capacity: { amount: 10, reset: "2026-01-01T00:00:00Z", every: { days: 1 } },
        },
      },
    },
  });
  await service.revisions.pull();
  expect(service.revisions.latest()?.commit).toBe(declared);
  expect(warnings()).toHaveLength(3);
});
