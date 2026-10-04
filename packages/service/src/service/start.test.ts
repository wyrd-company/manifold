// ---
// relationships:
//   verifies: service-assembly
// ---
import { afterEach, expect, test } from "vite-plus/test";
import { startService, githubWebhookPath } from "./index.ts";
import type { Service, ServiceStep } from "./index.ts";
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
  "escalations-opened",
  "portfolio-opened",
  "process-repository-opened",
  "revision-followed",
  "pulled",
  "actor-host-opened",
  "router-started",
  "escalations-started",
  "github-started",
  "t3code-started",
  "listening",
];
const stopSteps: ServiceStep[] = [
  "http-closed",
  "sources-stopped",
  "escalations-stopped",
  "revisions-idle",
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
  expect(service.revisions.latest()?.blueprints.size).toBe(1);
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
  expect(steps.slice(-6)).toEqual(stopSteps);
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

test("service exposes escalations to the actor host, mounts API answers, and retries held actors", async () => {
  const f = await fixture();
  const seed = await startService({ configurationFile: f.file, log: () => {} });
  seed.store.saveSnapshot({
    actorId: "parcel",
    machine: "delivery",
    snapshot: { status: "active", value: "waiting" },
  });
  seed.store.writeInbox(
    { eventId: "reading-one", topic: "weather.station", payload: { type: "reading" } },
    ["parcel"],
  );
  await seed.stop();
  let failed = true;
  let released = 0;
  let service!: Service;
  service = await startService({
    configurationFile: f.file,
    log: () => {},
    actorHost: (parts) => {
      expect(parts.escalations).toBeDefined();
      return {
        subscription: () => ({ topics: ["weather.station"] }),
        restore: (stored) =>
          failed
            ? { status: "held", reason: "Delivery failed" }
            : {
                status: "restored",
                target: {
                  actorId: stored.actorId,
                  send: () => {},
                  persist: () => ({
                    machine: "delivery",
                    snapshot: { status: "active", value: "received" },
                  }),
                },
              },
        release: (actorId) => {
          released++;
          failed = false;
          service.router.release(actorId);
        },
      };
    },
  });
  cleanup.push(service.stop);
  const escalation = service.escalations.list({ status: "open" })[0]!;
  expect(escalation.raiser).toMatchObject({
    type: "service",
    kind: "held-actor",
    subject: { actorId: "parcel" },
  });
  const path = url(service) + "/api/escalations/" + escalation.id + "/answer";
  const headers = { "Content-Type": "application/json" };
  expect(
    (await fetch(path, { method: "POST", headers, body: JSON.stringify({ choice: "retry" }) }))
      .status,
  ).toBe(200);
  await expect.poll(() => service.store.pendingInbox("parcel").length).toBe(0);
  expect(released).toBe(1);
  expect(
    (await fetch(path, { method: "POST", headers, body: JSON.stringify({ choice: "dismiss" }) }))
      .status,
  ).toBe(200);
  expect(released).toBe(1);
});

test("the service registry loads escalate blueprints and their callbacks answer through the HTTP host", async () => {
  const f = await fixture();
  const { createActor } = await import("xstate");
  const { escalationContractSchema } = await import("@wyrd-company/manifold-shared");
  await f.commit(60, {}, {
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
          on: { "escalation.answered": "delivered" },
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
        "escalation.answered": {
          $ref: escalationContractSchema.$id + "#/$defs/escalation-answered-event",
        },
      },
    },
  });
  let actor: ReturnType<typeof createActor> | undefined;
  const service = await startService({
    configurationFile: f.file,
    log: () => {},
    invocationOf: () => ({ actorId: "parcel", invokeId: "ask", entryId: "1" }),
    actorHost: (parts) => {
      const revision = parts.revisions.latest()!;
      expect([...revision.failures]).toEqual([]);
      const loaded = revision.blueprints.values().next().value!;
      actor = createActor(loaded.machine).start();
      return {
        subscription: () => ({ topics: [] }),
        restore: () => ({ status: "held", reason: "No saved actor" }),
      };
    },
  });
  cleanup.push(service.stop);
  try {
    const escalation = service.escalations.list({ status: "open" })[0]!;
    expect(escalation.question).toBe("Send the parcel?");
    const response = await fetch(url(service) + "/api/escalations/" + escalation.id + "/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Proceed" }),
    });
    expect(response.status).toBe(200);
    expect(actor?.getSnapshot().status).toBe("done");
    expect(service.escalations.get(escalation.id)?.answer?.value).toEqual({ text: "Proceed" });
  } finally {
    actor?.stop();
  }
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
