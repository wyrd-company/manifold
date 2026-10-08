// ---
// relationships:
//   verifies: [actor-history, usage-intake, blueprint-migration]
// ---
import { expect, test } from "vite-plus/test";
import { stringify } from "yaml";
import { startService } from "./service/index.ts";
import { migrationServiceFixture, parcel, changed } from "./migrations/test-fixtures/service.ts";
import type { UsageCall } from "@wyrd-company/manifold-shared";
import { isActorHistoryResponse } from "@wyrd-company/manifold-shared/actors-api";
import {
  actorUsageApiPath,
  isActorUsageResponse,
} from "@wyrd-company/manifold-shared/actor-usage-api";

const opening = {
  invoke: {
    id: "open",
    src: "thread-create",
    input: {
      type: "expression.map",
      params: {
        expression:
          '{"project":"project","title":"Parcel","model":{"instanceId":"provider","model":"model"}}',
      },
    },
    onDone: { target: "waiting", actions: "follow-thread" },
  },
};
const original = {
  ...parcel,
  machine: { ...parcel.machine, initial: "opening", states: { opening, ...parcel.machine.states } },
  schemas: { ...parcel.schemas, actors: { "thread-create": { input: true, output: true } } },
};
const target = {
  ...changed,
  machine: {
    ...changed.machine,
    initial: "opening",
    states: { opening, ...changed.machine.states },
  },
  schemas: { ...changed.schemas, actors: original.schemas.actors },
};

test("history and usage join each waiting visit across migration, including late calls and restart", async () => {
  const fixture = await migrationServiceFixture(original);
  const logs: unknown[] = [];
  let service = await startService({
    configurationFile: fixture.file,
    log: (entry) => logs.push(entry),
  });
  const actorId = "task:I_A";
  try {
    try {
      await expect
        .poll(() => service.store.loadSnapshot(actorId)?.snapshot.value, { timeout: 15000 })
        .toBe("waiting");
    } catch (error) {
      throw new Error(JSON.stringify(logs), { cause: error });
    }
    const context = service.store.loadSnapshot(actorId)!.snapshot["context"] as {
      manifold: { threads: string[] };
    };
    const threadId = context.manifold.threads[0]!;
    const before = service.history.read(actorId)!.visits.at(-1)!;
    const call = (key: string, at: number): UsageCall => ({
      type: "call",
      key,
      provider: "codex",
      providerSessionId: "session",
      unit: { id: "session", kind: "session" },
      timestamp: new Date(at).toISOString(),
      model: "model",
      speed: "standard",
      granularity: "call",
      estimated: false,
      tokens: {
        input: 10,
        output: 1,
        cacheRead: 0,
        cacheWrite: 0,
        cacheWriteOneHour: 0,
        reasoning: 0,
        webSearchRequests: 0,
      },
    });
    const push = (record: UsageCall) =>
      service.usage.push({
        environment: "workstation",
        threads: [{ provider: "codex", providerSessionId: "session", threadId }],
        records: [record],
      });
    push(call("before", Date.parse(before.enteredAt)));
    const saved = await service.revisions.save({
      path: "blueprints/parcel.yml",
      base: fixture.commit,
      text: stringify(target),
      message: "Split parcel depot",
      saveId: "c".repeat(32),
    });
    if (saved.outcome === "conflict") throw new Error("Unexpected conflict");
    await service.migrations.pass();
    const visits = service.history.read(actorId)!.visits.filter((v) => v.value === "waiting");
    expect(visits).toHaveLength(2);
    expect(visits[1]).toMatchObject({
      visit: before.visit + 1,
      blueprint: { commit: saved.commit },
    });
    push(call("after", Date.parse(visits[1]!.enteredAt)));
    push(call("late", Date.parse(before.enteredAt)));
    const verify = async () => {
      const { host, port } = service.http.address();
      const url = `http://${host}:${port}/api/actors/${encodeURIComponent(actorId)}`;
      const history: unknown = await (await fetch(`${url}/history`)).json();
      const usage: unknown = await (
        await fetch(`http://${host}:${port}${actorUsageApiPath(actorId)}`)
      ).json();
      expect(isActorHistoryResponse(history)).toBe(true);
      expect(isActorUsageResponse(usage)).toBe(true);
      if (!isActorHistoryResponse(history) || !isActorUsageResponse(usage))
        throw new Error("Invalid API answer");
      expect(usage.visits.map((v) => [v.visit, v.enteredAt, v.tokens.total])).toEqual(
        visits.map((v, i) => [v.visit, v.enteredAt, i === 0 ? 22 : 11]),
      );
      expect(usage.calls.map((c) => c.visit)).toEqual([
        before.visit,
        before.visit,
        before.visit + 1,
      ]);
      expect(history.history.visits.filter((v) => v.value === "waiting")).toEqual(visits);
    };
    await verify();
    await service.stop();
    service = await startService({ configurationFile: fixture.file, log: () => {} });
    await verify();
  } finally {
    await service.stop();
    await fixture.close();
  }
});

test("history records a new visit before usage attributes calls from its first followed thread", async () => {
  const fixture = await migrationServiceFixture(original);
  const service = await startService({ configurationFile: fixture.file, log: () => {} });
  try {
    await expect
      .poll(() => service.store.loadSnapshot("task:I_A")?.snapshot.value, { timeout: 15000 })
      .toBe("waiting");
    fixture.t3.commandHooks.accepted = (command) => {
      if (command.type !== "thread.create") return;
      service.usage.push({
        environment: "workstation",
        threads: [
          { provider: "codex", providerSessionId: "early-session", threadId: command.threadId },
        ],
        records: [
          {
            type: "call",
            key: "early",
            provider: "codex",
            providerSessionId: "early-session",
            unit: { id: "early-session", kind: "session" },
            timestamp: new Date(Date.now() + 60000).toISOString(),
            model: "model",
            speed: "standard",
            granularity: "call",
            estimated: false,
            tokens: {
              input: 10,
              output: 1,
              cacheRead: 0,
              cacheWrite: 0,
              cacheWriteOneHour: 0,
              reasoning: 0,
              webSearchRequests: 0,
            },
          },
        ],
      });
    };
    const loaded = await service.blueprints.version({
      commit: fixture.commit,
      path: "blueprints/parcel.yml",
    });
    if (loaded.status !== "loaded") throw new Error(JSON.stringify(loaded));
    service.actorHost.start({
      actorId: "parcel-two",
      blueprint: loaded.blueprint,
      input: { manifold: { environment: "workstation", portfolioItem: "other" } },
    });
    await expect
      .poll(() => service.store.loadSnapshot("parcel-two")?.snapshot.value, { timeout: 15000 })
      .toBe("waiting");
    const visit = service.history.visits("parcel-two").at(-1)!;
    expect(visit.value).toBe("waiting");
    expect(visit.visit).toBe(2);
    expect(service.usage.actorVisitUsage("parcel-two").calls.map((c) => c.visit)).toEqual([
      visit.visit,
    ]);
  } finally {
    await service.stop();
    await fixture.close();
  }
});
