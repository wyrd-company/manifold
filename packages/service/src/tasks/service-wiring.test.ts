// ---
// relationships:
//   verifies: [tasks-api, operator-console, service-assembly]
// ---
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify } from "yaml";
import { expect, test } from "vite-plus/test";
import { startService } from "../service/index.ts";
import { serviceFixture } from "../service/test-fixtures/repository.ts";
import { isTasksResponse } from "@wyrd-company/manifold-shared/tasks-api";
test("service mounts tasks with live bindings, excludes archived bindings, and reads the lifecycle declaration in force", async () => {
  const f = await serviceFixture();
  let service: Awaited<ReturnType<typeof startService>> | undefined;
  try {
    await f.commit(60, {
      taskMetadata: {
        projects: { sample: { lifecycle: { field: "Stage", options: ["Ready", "Delivered"] } } },
      },
      bindings: {
        githubProjects: {
          sample: { owner: "sample", number: 1, item: "alpha", environment: "sample-host" },
          archived: {
            owner: "sample",
            number: 2,
            item: "beta",
            environment: "sample-host",
            archived: true,
          },
        },
      },
    });
    f.api.addItem("IT_A", "I_A");
    service = await startService({
      configurationFile: f.file,
      log: () => {},
    });
    const { host, port } = service.http.address(),
      url = `http://${host}:${port}/api/tasks`;
    await expect.poll(() => service!.github.trackedIssueIds()).toContain("I_A");
    const response = await fetch(url),
      body = await response.json();
    expect(response.status).toBe(200);
    expect(isTasksResponse(body)).toBe(true);
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0]).toMatchObject({
      binding: "sample",
      lifecycle: { field: "Stage", options: ["Ready", "Delivered"] },
      tasks: [{ actorId: "task:I_A" }],
    });
  } finally {
    await service?.stop();
    await f.close();
  }
});

test("service task reads include mapping-only late usage for running and settled actors", async () => {
  const f = await serviceFixture();
  let service: Awaited<ReturnType<typeof startService>> | undefined;
  try {
    await f.commit(60, {
      accounts: {
        accounts: {
          acct: {
            unit: "usd",
            kind: "api",
            capacity: { amount: 1, reset: "2026-01-01T00:00:00Z", every: { hours: 1 } },
            usage: [{ environment: "env-one", provider: "codex" }],
          },
        },
      },
      prices: { unit: "usd", models: { "model-a": { standard: { input: 15, output: 0 } } } },
      bindings: {
        githubProjects: {
          sample: { owner: "sample", number: 1, item: "alpha", environment: "env-one" },
        },
      },
    });
    await writeFile(join(f.directory, "environment.token"), "example-environment-token");
    await writeFile(
      f.file,
      stringify({
        ...f.configuration,
        credentials: {
          ...f.configuration.credentials,
          environment: { kind: "t3code-token", tokenFile: "environment.token" },
        },
        environments: { "env-one": { url: "http://127.0.0.1:1", credential: "environment" } },
      }),
    );
    f.api.addItem("IT_A", "I_A");
    service = await startService({ configurationFile: f.file, log: () => {} });
    await expect.poll(() => service!.github.trackedIssueIds()).toContain("I_A");
    const { host, port } = service.http.address();
    const url = `http://${host}:${port}`;
    service.portfolio.ledger.credit({
      key: "credit-one",
      account: "acct",
      window: "window-one",
      opensAt: 0,
      closesAt: 1000,
      amount: 100,
    });
    const push = (body: unknown) =>
      fetch(url + "/api/usage/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    for (const [index, settled] of [false, true].entries()) {
      const threadId = `thread-${index}`;
      const providerSessionId = `session-${index}`;
      const snapshot = {
        status: "active" as const,
        value: "working",
        context: {
          manifold: { environment: "env-one", portfolioItem: "alpha", threads: [threadId] },
        },
      };
      service.store.saveSnapshot({ actorId: "task:I_A", machine: "sample-machine", snapshot });
      service.usage.saveHook({ actorId: "task:I_A", snapshot });
      if (index === 0)
        service.portfolio.ledger.reserve({
          key: "reserve-one",
          actor: "task:I_A",
          item: "alpha",
          account: "acct",
          amount: 10,
        });
      expect(
        (
          await push({
            environment: "env-one",
            threads: [],
            records: [
              {
                type: "call",
                key: `call-${index}`,
                provider: "codex",
                providerSessionId,
                unit: { id: providerSessionId, kind: "session" },
                timestamp: new Date(100).toISOString(),
                model: "model-a",
                tokens: {
                  input: 1,
                  output: 0,
                  cacheRead: 0,
                  cacheWrite: 0,
                  cacheWriteOneHour: 0,
                  reasoning: 0,
                  webSearchRequests: 0,
                },
                speed: "standard",
                granularity: "call",
                estimated: false,
              },
            ],
          })
        ).status,
      ).toBe(200);
      if (settled)
        service.usage.saveHook({
          actorId: "task:I_A",
          snapshot: { ...snapshot, status: "done", value: "finished" },
        });
      const before = await fetch(url + "/api/tasks/task%3AI_A");
      expect(await before.json()).toMatchObject({
        task: { usage: { accounts: [{ actual: index * 15 }] } },
      });
      const mapping = {
        environment: "env-one",
        threads: [{ provider: "codex", providerSessionId, threadId }],
        records: [],
      };
      for (let replay = 0; replay < 2; replay++) {
        expect((await push(mapping)).status).toBe(200);
        const response = await fetch(url + "/api/tasks/task%3AI_A");
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
          task: {
            usage: {
              settled,
              accounts: [
                {
                  account: "acct",
                  estimate: 10,
                  actual: (index + 1) * 15,
                  variance: (index + 1) * 15 - 10,
                  reserved: settled ? 0 : 10,
                },
              ],
            },
          },
        });
      }
    }
  } finally {
    await service?.stop();
    await f.close();
  }
});
