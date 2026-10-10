// ---
// relationships:
//   verifies: [default-process, service-assembly, intake, gate-runtime, agent-threads, agent-tools, usage-intake, host-cli-usage, tasks-api, declarations-api, portfolio-api, projects-api, actor-history, blueprint-migration, environments-api, usage-api, task-metadata, decision-models, retention]
// ---
import { afterEach, expect, it } from "vite-plus/test";
import { readFile, writeFile } from "node:fs/promises";
import * as fs from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { once } from "node:events";
import { fork, execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";
import { isTaskResponse } from "@wyrd-company/manifold-shared/tasks-api";
import git from "isomorphic-git";
import { schemas } from "@wyrd-company/t3code-client";
import { parse, stringify } from "yaml";
import { serviceFixture } from "./service/test-fixtures/repository.ts";
import { commandServer } from "./agent-threads/test-fixtures/commands.ts";
import { signedDelivery } from "./github-source/test-fixtures/api.ts";
import { serve, readRequest } from "./escalations/test-support.ts";
import { openStore } from "./store/index.ts";
import { openPortfolio } from "./portfolio/index.ts";
import { shippedBundle } from "./bundle/index.ts";
import { childArtifacts } from "../../../test-support/child-process.ts";
import { organizationFake } from "./github-source/test-fixtures/organization-api.ts";
import { repositoryFixture as repositoryFieldsFixture } from "./github-repository-fields/test-fixtures/repository.ts";
import {
  applyModelDraft,
  changedFiles,
  settleModelDraft,
} from "../../console/src/screens/blueprints/decision-model/model-drafts.ts";
import {
  prepareModel,
  writeModel,
} from "../../console/src/screens/blueprints/decision-model/decision-model-text.ts";
import { fixtureThread } from "./t3code-source/test-fixtures/server.ts";
import { sampleCall } from "./declarations-api/test-fixtures/usage.ts";
import { readDraft, writeDraft } from "../../console/src/screens/blueprints/draft.ts";
const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
});
async function fixture(
  refuseMove = false,
  crash?: "event" | "command",
  extend?: (files: Map<string, string>) => void,
  additionalStorage = false,
) {
  const f = await serviceFixture();
  cleanup.push(f.close);
  await git.setConfig({ fs, gitdir: f.remote.gitdir, path: "http.receivepack", value: true });
  const organization = additionalStorage ? await organizationFake(f.api) : undefined;
  if (organization) cleanup.push(organization.close);
  const repository = additionalStorage ? await repositoryFieldsFixture() : undefined;
  if (repository) cleanup.push(repository.close);
  let afterBodyWrite: (() => void) | undefined;
  const github = additionalStorage
    ? await serve((request, response) => {
        void (async () => {
          const body = await readRequest(request);
          const rest = request.url!.startsWith("/repos/");
          const upstream = await fetch(
            (rest ? repository!.apiUrl : organization!.url) + request.url,
            {
              method: request.method ?? "GET",
              headers: { "content-type": "application/json" },
              ...(request.method !== "GET" ? { body } : {}),
            },
          );
          const text = await upstream.text();
          if (
            request.url === "/graphql" &&
            upstream.ok &&
            /\bmutation GitHubIssueBodyWrite\b/.test(JSON.parse(body).query ?? "")
          )
            afterBodyWrite?.();
          if (!rest && text.includes('"issueFieldValues"')) {
            const answer = JSON.parse(text);
            for (const issue of answer.data.nodes ?? []) {
              if (issue?.id !== "I_A") continue;
              issue.labels.nodes = repository!.assigned().map((name) => {
                const label = repository!.labels().find((l) => l.name === name)!;
                return { id: label.node_id, name };
              });
              const number = repository!.milestone();
              issue.milestone = number === null ? null : { id: "M_one", number, title: "Spring" };
            }
            response
              .writeHead(upstream.status, { "content-type": "application/json" })
              .end(JSON.stringify(answer));
          } else
            response.writeHead(upstream.status, { "content-type": "application/json" }).end(text);
        })();
      })
    : undefined;
  if (github) cleanup.push(github.close);
  const t3 = await commandServer();
  cleanup.push(t3.close);
  f.api.fields.splice(0, f.api.fields.length, {
    id: "F_status",
    name: "Status",
    options: [
      { id: "O_todo", name: "Todo" },
      { id: "O_progress", name: "In Progress" },
      { id: "O_done", name: "Done" },
    ],
  });
  if (refuseMove) f.api.failWrite("FORBIDDEN");
  const moves = () =>
    f.api.log
      .filter((entry) => entry.operation === "GitHubCardMove")
      .map(
        (entry) =>
          f.api.fields[0]!.options.find((option) => option.id === entry.variables["option"])!.name,
      );
  const notifications: { message: string }[] = [];
  const ntfy = await serve((request, response) => {
    void readRequest(request).then((body) => {
      notifications.push(JSON.parse(body));
      response.writeHead(200).end("{}");
    });
  });
  cleanup.push(ntfy.close);
  await writeFile(join(f.directory, "t3.token"), "fixture-token");
  await writeFile(
    f.file,
    stringify({
      ...f.configuration,
      ...(github ? { github: { ...f.configuration.github, apiUrl: github.url } } : {}),
      // This fixture exercises successful grants, with finite comparator work.
      comparatorSandbox: { timeoutMs: 500 },
      credentials: {
        ...f.configuration.credentials,
        writer: { kind: "t3code-token", tokenFile: "t3.token" },
      },
      environments: { workstation: { url: t3.url, credential: "writer" } },
      escalations: {
        publicUrl: "http://127.0.0.1:12345",
        destinations: { default: { server: ntfy.url, topic: "example-topic", posture: "open" } },
      },
    }),
  );
  const starterRoot = new URL("../../../examples/starter/", import.meta.url);
  const paths = [
    "manifold.yml",
    "portfolio.yml",
    "bindings.yml",
    "accounts.yml",
    "task-metadata.yml",
    "decision-models/intake.yml",
    "comparators/estimate.ts",
    "templates/task.njk",
  ];
  const files = new Map(
    await Promise.all(
      paths.map(
        async (path) => [path, await readFile(new URL(path, starterRoot), "utf8")] as const,
      ),
    ),
  );
  const intake = parse(files.get("decision-models/intake.yml")!);
  intake.nodes[1].content.config.rules[0].blueprint =
    'task.issue.nodeId = "I_B" ? "blueprints/notice.yml" : "blueprints/task.yml"';
  files.set("decision-models/intake.yml", stringify(intake));
  const helper = parse(
    await readFile(
      new URL("../../../testing/uat/blueprints/project-and-message.yml", import.meta.url),
      "utf8",
    ),
  );
  helper.machine.context.recipientIssue = "I_A";
  files.set("blueprints/notice.yml", stringify(helper));
  const bindings = parse(files.get("bindings.yml")!);
  Object.assign(bindings.githubProjects["work-board"], {
    owner: "sample",
    t3codeProjects: ["project"],
  });
  files.set("bindings.yml", stringify(bindings));
  files.set(
    "prices.yml",
    stringify({
      unit: "usd",
      models: { "sample-model": { standard: { input: 0.5, output: 0.5, cacheRead: 0.5 } } },
    }),
  );
  extend?.(files);
  async function tree(prefix: string): Promise<string> {
    const names = [
      ...new Set(
        [...files.keys()]
          .filter((path) => path.startsWith(prefix))
          .map((path) => path.slice(prefix.length).split("/")[0]!),
      ),
    ].sort();
    return git.writeTree({
      fs,
      gitdir: f.remote.gitdir,
      tree: await Promise.all(
        names.map(async (name) => {
          const path = prefix + name;
          return files.has(path)
            ? {
                path: name,
                mode: "100644",
                type: "blob" as const,
                oid: await git.writeBlob({
                  fs,
                  gitdir: f.remote.gitdir,
                  blob: Buffer.from(files.get(path)!),
                }),
              }
            : { path: name, mode: "040000", type: "tree" as const, oid: await tree(path + "/") };
        }),
      ),
    });
  }
  const author = {
    name: "Example",
    email: "example@example.test",
    timestamp: 1700000000,
    timezoneOffset: 0,
  };
  const commit = await git.writeCommit({
    fs,
    gitdir: f.remote.gitdir,
    commit: {
      tree: await tree(""),
      parent: [f.first],
      message: "Starter process",
      author,
      committer: author,
    },
  });
  await git.writeRef({
    fs,
    gitdir: f.remote.gitdir,
    ref: "refs/heads/main",
    value: commit,
    force: true,
  });
  const logs: unknown[] = [];
  const startedAt = performance.now();
  const timeline: { at: number; stage: string }[] = [];
  const faults: { boundary: string; eventId?: string; commandId?: string }[] = [];
  async function start() {
    const fault = crash;
    crash = undefined;
    const worker = fork(
      join(childArtifacts().service, "test-fixtures/default-process-worker.js"),
      [JSON.stringify({ file: f.file, crash: fault })],
      { silent: true, execArgv: [] },
    );
    let stderr = "";
    worker.on("message", (message) => {
      const value = message as { type: string; entry: unknown };
      if (value.type === "log") {
        logs.push(value.entry);
        timeline.push({ at: performance.now() - startedAt, stage: JSON.stringify(value.entry) });
      }
      if (value.type === "fault")
        faults.push(message as { boundary: string; eventId?: string; commandId?: string });
    });
    worker.stderr!.on("data", (chunk) => {
      stderr += String(chunk);
    });
    const exited = new Promise((resolve) => worker.once("exit", (code) => resolve(code)));
    cleanup.push(async () => {
      if (worker.exitCode === null && worker.signalCode === null) {
        worker.kill("SIGKILL");
        await exited;
      }
    });
    const ready = await new Promise<{ host: string; port: number }>((resolve, reject) => {
      worker.on("message", (message) => {
        const value = message as { type: string; address: { host: string; port: number } };
        if (value.type === "ready") resolve(value.address);
      });
      worker.once("exit", () => reject(new Error(stderr)));
    });
    return { worker, exited, url: `http://${ready.host}:${ready.port}` };
  }
  let running = await start();
  const store = openStore({ path: join(f.directory, "data/state.sqlite") });
  cleanup.push(() => store.close());
  const portfolio = openPortfolio({ connection: store.connection });
  const snapshot = () => store.loadSnapshot("task:I_A")?.snapshot;
  const state = () => snapshot()?.value;
  const agentCall = async (tool: string, args: Record<string, unknown>, meta = {}) =>
    fetch(running.url + "/api/agent-tools/calls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ environment: "workstation", tool, arguments: args, meta }),
    });
  async function add(issue = "I_A", item = "item-one", expectedStatus = 202) {
    f.api.addItem(item, issue);
    f.api.items.get(item)!.fieldValues.nodes.push({
      __typename: "ProjectV2ItemFieldNumberValue",
      number: 0.00001,
      field: { id: "F_estimate", name: "Estimate", dataType: "NUMBER" },
    });
    const delivery = signedDelivery(
      "projects_v2_item",
      {
        action: "created",
        projects_v2_item: {
          node_id: item,
          project_node_id: "P_one",
          content_node_id: issue,
          content_type: "Issue",
        },
        organization: { login: "sample" },
      },
      "delivery-" + item,
    );
    timeline.push({ at: performance.now() - startedAt, stage: "webhook-post" });
    expect(
      (
        await fetch(running.url + "/webhooks/github", {
          method: "POST",
          headers: delivery.headers,
          body: delivery.body,
        })
      ).status,
    ).toBe(expectedStatus);
  }
  async function waiting() {
    try {
      await expect.poll(state, { timeout: 15000 }).toEqual({ active: { working: "waiting" } });
    } catch (error) {
      throw new Error(
        JSON.stringify({
          logs,
          snapshot: snapshot(),
          errored: store.loadErroredSnapshot("task:I_A"),
        }),
        { cause: error },
      );
    }
  }
  async function handoff(threadId = [...t3.threads.keys()].at(-1)!) {
    const thread = t3.threads.get(threadId)!;
    const callId = "handoff-" + thread.latestTurn!.turnId;
    thread.activities.push(
      schemas.orchestrationReadModel.OrchestrationThreadActivity.parse({
        id: callId,
        tone: "tool",
        summary: "Tool started",
        kind: "tool.started",
        turnId: thread.latestTurn!.turnId,
        createdAt: new Date().toISOString(),
        payload: { toolCallId: callId },
      }),
    );
    expect(
      (
        await agentCall(
          "handoff",
          {
            thread: threadId,
            handoff: { summary: "Parcel packed" },
          },
          { callId },
        )
      ).status,
    ).toBe(200);
    await expect.poll(state).toBe("done");
  }
  return {
    ...f,
    files,
    organization,
    repository,
    holdBodyObservation() {
      return new Promise<ReturnType<typeof f.api.hold>>((resolve) => {
        afterBodyWrite = () => {
          const held = f.api.hold("GitHubIssues");
          cleanup.push(held.release);
          afterBodyWrite = undefined;
          resolve(held);
        };
      });
    },
    commit,
    store,
    portfolio,
    t3,
    moves,
    notifications,
    get url() {
      return running.url;
    },
    get worker() {
      return running.worker;
    },
    get exited() {
      return running.exited;
    },
    async resumeKilled() {
      expect(await running.exited).toBeNull();
      expect(running.worker.signalCode).toBe("SIGKILL");
      expect(faults).toHaveLength(1);
      const fault = faults[0]!;
      if (fault.boundary === "event") {
        expect(store.pendingInbox("task:I_A").some((row) => row.eventId === fault.eventId)).toBe(
          true,
        );
        expect(
          store.connection.database
            .prepare("SELECT * FROM history_event WHERE actor_id=? AND event_id=?")
            .all("task:I_A", fault.eventId!),
        ).toEqual([]);
      } else {
        expect(
          store.connection.database
            .prepare("SELECT accepted_at FROM history_command WHERE command_id=?")
            .get(fault.commandId!)?.["accepted_at"],
        ).toBeNull();
      }
      running = await start();
    },
    async requestWorker(action: string, arguments_: Record<string, unknown> = {}) {
      const id = crypto.randomUUID();
      const answer = new Promise<Record<string, unknown>>((resolve) => {
        const listener = (raw: unknown) => {
          const message = raw as { id: string; answer: Record<string, unknown> };
          if (message.id === id) {
            running.worker.off("message", listener);
            resolve(message.answer);
          }
        };
        running.worker.on("message", listener);
      });
      running.worker.send({ id, action, arguments: arguments_ });
      return answer;
    },
    async restart(beforeStart?: () => Promise<void>) {
      running.worker.kill("SIGKILL");
      expect(await running.exited).toBeNull();
      expect(running.worker.signalCode).toBe("SIGKILL");
      await beforeStart?.();
      running = await start();
    },
    faults,
    timeline,
    elapsed: () => performance.now() - startedAt,
    logs,
    snapshot,
    state,
    add,
    waiting,
    agentCall,
    handoff,
  };
}
it("runs the starter acceptance scenario through recovery, plugin messages, Project drift, portfolio save, waiting migration, environment pause, ended history and usage move", async () => {
  const f = await fixture();
  const get = async (path: string) => {
    const response = await fetch(f.url + path);
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    return body;
  };
  const post = async (path: string, body: unknown) => {
    const response = await fetch(f.url + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const answer = await response.json();
    expect(response.status, JSON.stringify(answer)).toBe(200);
    return answer;
  };
  await expect
    .poll(async () => (await fetch(f.url + "/api/projects/work-board/plan")).status)
    .toBe(200);
  const planned = await get("/api/projects/work-board/plan");
  expect(planned).toMatchObject({
    observation: { status: "fresh" },
    configuration: { state: "not-applied" },
  });
  const applied = await post("/api/projects/work-board/apply", {
    removeUndeclared: false,
    digest: planned.digest,
  });
  expect(applied).toMatchObject({ configuration: { state: "in-sync" } });
  const option = f.api.fields.find((field) => field.name === "Status")!.options[0]!;
  const optionId = option.id;
  option.name = "Ready";
  expect(await get("/api/projects/work-board/plan")).toMatchObject({
    configuration: { state: "drift", count: 1 },
    changes: [
      expect.objectContaining({
        drift: true,
        target: expect.objectContaining({ lifecycle: true, option: "Todo" }),
      }),
    ],
  });
  expect(await post("/api/projects/work-board/apply", { removeUndeclared: false })).toMatchObject({
    writes: 1,
    configuration: { state: "in-sync" },
  });
  expect(f.api.fields.find((field) => field.name === "Status")!.options[0]).toMatchObject({
    id: optionId,
    name: "Todo",
  });
  await post("/api/environments/workstation/pause", {});
  expect(await get("/api/environments")).toMatchObject({
    environments: [expect.objectContaining({ name: "workstation", paused: true })],
  });
  await f.add();
  try {
    await expect
      .poll(
        async () => {
          const environment = (await get("/api/environments")).environments[0];
          f.timeline.push({
            at: f.elapsed(),
            stage: JSON.stringify({ environment, snapshot: f.snapshot() }),
          });
          return environment;
        },
        { timeout: 15000 },
      )
      .toMatchObject({ paused: true, scheduledThreads: 1 });
  } catch (error) {
    console.log(
      "STARTER_SCHEDULE_MISS " +
        JSON.stringify({
          timeline: f.timeline,
          logs: f.logs,
          snapshot: f.snapshot(),
          evaluations: f.store.connection.database.prepare("SELECT * FROM gates_evaluation").all(),
          notifications: f.notifications,
        }),
    );
    throw error;
  }
  console.log(
    "STARTER_SCHEDULE " +
      JSON.stringify({
        elapsedMs:
          f.timeline.at(-1)!.at - f.timeline.find((entry) => entry.stage === "webhook-post")!.at,
        snapshot: f.snapshot()?.value,
        evaluations: f.store.connection.database
          .prepare(
            "SELECT outcome, duration_ms, failure_kind, failure_message FROM gates_evaluation",
          )
          .all(),
      }),
  );
  expect(f.t3.commands).toEqual([]);
  expect(f.t3.threads.size).toBe(0);
  await post("/api/environments/workstation/resume", {});
  await f.waiting();
  expect(await get("/api/environments")).toMatchObject({
    environments: [expect.objectContaining({ paused: false, scheduledThreads: 0 })],
  });
  expect(f.moves()).toEqual(["In Progress"]);
  expect(f.snapshot()).toMatchObject({ status: "active" });
  expect(f.store.loadSnapshot("task:I_A")!.machine).toBe(
    `${f.commit}:blueprints/task.yml@${shippedBundle.digest}`,
  );
  expect(f.t3.threads.size).toBe(1);
  const thread = [...f.t3.threads.values()][0]!;
  expect(thread.title).toBe("sample/records#1");
  expect(thread.projectId).toBe("project");
  expect(thread.messages).toHaveLength(1);
  expect(thread.messages[0]!.text).toContain("sample/records#1");
  expect(thread.messages[0]!.text).toContain(thread.id);
  expect(f.portfolio.ledger.actorUsage("task:I_A")).toMatchObject({
    settled: false,
    accounts: [{ account: "agents", estimate: 10, actual: 0 }],
  });
  expect(thread.latestTurn?.state).toBe("running");
  const turn = thread.latestTurn!.turnId;
  const usedAt = new Date().toISOString();
  expect(f.portfolio.ledger.windowAt({ account: "agents", at: Date.now() }).current).toMatchObject({
    capacity: 100000000,
  });
  // The default returns the token on leaving todo; its reservation lasts until settlement.
  const grantedToken = () =>
    f.store.connection.database
      .prepare("SELECT token_id, return_reason, returned_at FROM gates_token WHERE actor_id = ?")
      .get("task:I_A");
  expect(grantedToken()).toMatchObject({
    return_reason: "return-point",
    returned_at: expect.any(Number),
  });
  expect(f.portfolio.ledger.actorUsage("task:I_A").accounts[0]?.outstanding).toBe(10);
  const token = grantedToken();
  await f.restart();
  await f.waiting();
  expect(thread.latestTurn!.turnId).toBe(turn);
  expect(thread.messages).toHaveLength(1);
  expect(f.t3.commands.map((command) => command.type)).toEqual([
    "thread.create",
    "thread.turn.start",
  ]);
  expect(grantedToken()).toEqual(token);
  expect(f.portfolio.ledger.actorUsage("task:I_A")).toMatchObject({
    settled: false,
    accounts: [{ account: "agents", estimate: 10, actual: 0, outstanding: 10 }],
  });
  expect(
    f.t3.requests.filter(
      (request) =>
        request.tag === "orchestration.subscribeThread" &&
        request.payload["threadId"] === thread.id,
    ).length,
  ).toBeGreaterThanOrEqual(2);
  expect(f.moves()).toEqual(["In Progress"]);
  const boardReads = [];
  for (const size of [1, 32]) {
    const answer = await f.requestWorker("board", { size });
    expect(answer).toMatchObject({ status: 200, issues: size, mirrorReads: 1 });
    boardReads.push(answer);
  }
  console.log("BOARD_MIRROR_READS " + JSON.stringify(boardReads));
  // Save a repository replacement for the bundled blueprint while the actor waits.
  const beforeMigration = f.store.loadSnapshot("task:I_A")!;
  const { isActorHistoryResponse } = await import("@wyrd-company/manifold-shared/actors-api");
  const { isActorUsageResponse } = await import("@wyrd-company/manifold-shared/actor-usage-api");
  const waitingHistory = await get("/api/actors/task%3AI_A/history");
  if (!isActorHistoryResponse(waitingHistory)) throw new Error("Invalid actor history");
  const oldVisit = waitingHistory.history.visits.at(-1)!;
  async function pushVisitCall(key: string, enteredAt: string) {
    return post("/api/usage/push", {
      environment: "workstation",
      threads: [{ provider: "codex", providerSessionId: "waiting-session", threadId: thread.id }],
      records: [
        {
          type: "call",
          key,
          provider: "codex",
          providerSessionId: "waiting-session",
          unit: { id: "waiting-session", kind: "session" },
          timestamp: enteredAt,
          model: "sample-model",
          speed: "standard",
          granularity: "call",
          estimated: false,
          tokens: {
            input: 1,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            cacheWriteOneHour: 0,
            reasoning: 0,
            webSearchRequests: 0,
          },
        },
      ],
    });
  }
  await pushVisitCall("before-migration", oldVisit.enteredAt);
  const next = parse(shippedBundle.files.get("blueprints/task.yml")!);
  next.machine.context.labelFormat = "revised";
  next.schemas.context.required.push("labelFormat");
  next.schemas.context.properties.labelFormat = { const: "revised" };
  next.migrations = [
    {
      from: parse(shippedBundle.files.get("blueprints/task.yml")!).schemas.context,
      context: {
        type: "expression.map",
        params: {
          expression:
            '$merge([$sift(context, function($v, $k) { $k != "manifold" }), {"labelFormat": "revised"}])',
        },
      },
    },
  ];
  next.machine.states.active.on["agent.handoff"].guard.params.expression +=
    ' and context.labelFormat = "revised"';
  const blueprintSaved = await post("/api/blueprints/save", {
    path: "blueprints/task.yml",
    base: f.commit,
    text: stringify(next),
    message: "Revise parcel label format",
    saveId: "2".repeat(32),
  });
  expect(blueprintSaved).toMatchObject({ outcome: "saved" });
  await expect
    .poll(() => f.store.loadSnapshot("task:I_A")!.machine)
    .toBe(`${blueprintSaved.commit}:blueprints/task.yml`);
  expect(f.snapshot()).toMatchObject({
    value: beforeMigration.snapshot.value,
    context: { labelFormat: "revised", thread: thread.id },
    entries: beforeMigration.snapshot["entries"],
  });
  expect(grantedToken()).toEqual(token);
  expect(thread.messages).toHaveLength(1);
  const migratedHistory = await get("/api/actors/task%3AI_A/history");
  if (!isActorHistoryResponse(migratedHistory)) throw new Error("Invalid actor history");
  const newVisit = migratedHistory.history.visits.at(-1)!;
  expect(newVisit.value).toEqual(oldVisit.value);
  expect(newVisit.visit).toBe(oldVisit.visit + 1);
  expect(newVisit.blueprint?.commit).toBe(blueprintSaved.commit);
  await pushVisitCall("after-migration", newVisit.enteredAt);
  const visitUsage = await get("/api/usage/actors/task%3AI_A");
  if (!isActorUsageResponse(visitUsage)) throw new Error("Invalid actor usage");
  expect(
    visitUsage.visits.map((visit) => [visit.visit, visit.enteredAt, visit.tokens.total]),
  ).toEqual([oldVisit, newVisit].map((visit) => [visit.visit, visit.enteredAt, 1]));
  expect(visitUsage.calls.map((call) => call.visit)).toEqual([oldVisit.visit, newVisit.visit]);
  // Populate UAT rows while the child service is stopped, then prune with the assembled service.
  await f.restart(async () => {
    await promisify(execFile)(process.execPath, [
      new URL("../../../testing/uat/seed-retention.mjs", import.meta.url).pathname,
      "--store",
      join(f.directory, "data/state.sqlite"),
      "--service-stopped",
    ]);
  });
  await f.waiting();
  const activeHistory = await get("/api/actors/task%3AI_A/history");
  expect(await f.requestWorker("prune")).toMatchObject({
    actors: 1,
    inboxRows: 1,
    historyRows: 2,
    sourceEvents: 1,
    gateEvaluations: 1,
  });
  expect(await get("/api/actors/task%3AI_A/history")).toEqual(activeHistory);
  await f.restart();
  await f.waiting();
  await f.add("I_A", "item-one", 200); // The original signed delivery is replayed with its original GUID.
  expect(await get("/api/actors/task%3AI_A/history")).toEqual(activeHistory);
  expect(await get("/api/usage/actors/task%3AI_A")).toEqual(visitUsage);
  expect(await pushVisitCall("after-migration", newVisit.enteredAt)).toMatchObject({
    calls: { accepted: 0 },
  });
  expect(thread.messages).toHaveLength(1);
  expect(f.t3.commands).toHaveLength(2);
  // A second issue invokes send-message; the recipient's actor saves its routed event.
  await f.add("I_B", "item-two");
  await expect
    .poll(() => f.store.loadSnapshot("task:I_B")?.snapshot.status, { timeout: 15000 })
    .toBe("done");
  const createdHistory = await get("/api/actors/task%3AI_B/history");
  if (!isActorHistoryResponse(createdHistory)) throw new Error("Invalid actor history");
  const projectCommand = f.t3.commands.find((command) => command.type === "project.create")!;
  expect(createdHistory.history.commands).toEqual([
    expect.objectContaining({
      kind: "project-create",
      commandId: projectCommand.commandId,
      invokeId: "create-project",
      entryId: expect.any(String),
      environment: "workstation",
      projectId: projectCommand.type === "project.create" ? projectCommand.projectId : "",
      acceptedAt: expect.any(String),
    }),
  ]);
  expect(createdHistory.history.commands[0]).not.toHaveProperty("threadId");
  const plugin = spawn(childArtifacts().host, [
    "mcp",
    "--service",
    f.url,
    "--environment",
    "workstation",
  ]);
  const pluginExited = once(plugin, "exit");
  const replies: Record<string, unknown>[] = [];
  createInterface({ input: plugin.stdout }).on("line", (line) => replies.push(JSON.parse(line)));
  cleanup.push(async () => {
    if (plugin.exitCode === null && plugin.signalCode === null) {
      plugin.stdin.end();
      await pluginExited;
    }
  });
  const request = (value: unknown) => plugin.stdin.write(JSON.stringify(value) + "\n");
  request({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "parcel", version: "1" },
    },
  });
  await expect
    .poll(() => replies.find((reply) => reply["id"] === 1), { timeout: 15000 })
    .toHaveProperty("result");
  request({ jsonrpc: "2.0", method: "notifications/initialized" });
  const read = (id: number) =>
    request({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: {
        name: "get-messages",
        arguments: { thread: thread.id },
      },
    });
  read(2);
  await expect
    .poll(() => replies.find((reply) => reply["id"] === 2))
    .toMatchObject({
      result: {
        isError: false,
        structuredContent: {
          status: "read",
          threadId: thread.id,
          turnId: turn,
          messages: [
            {
              from: { actorId: "task:I_B", issue: "I_B" },
              text: "The parcel label changed.",
              deliveredAt: expect.any(String),
            },
          ],
        },
      },
    });
  read(3);
  await expect
    .poll(() => replies.find((reply) => reply["id"] === 3)?.["result"])
    .toEqual(replies.find((reply) => reply["id"] === 2)?.["result"]);
  plugin.stdin.end();
  expect(await pluginExited).toEqual([0, null]);
  expect(
    (
      await f.agentCall("handoff", {
        thread: thread.id,
        handoff: {},
      })
    ).status,
  ).toBe(422);
  await f.handoff();
  expect(f.moves()).toEqual(["In Progress", "Done"]);
  expect(f.snapshot()).toMatchObject({
    status: "done",
    output: { outcome: "done", handoff: { summary: "Parcel packed" } },
  });
  // Read the ended actor after GitHub has confirmed both writes.
  await expect
    .poll(() =>
      f.store.connection.database
        .prepare("SELECT * FROM github_card_move WHERE actor_id=?")
        .all("task:I_A"),
    )
    .toEqual([]);
  const ended = await get("/api/actors/task%3AI_A/history");
  expect(isActorHistoryResponse(ended)).toBe(true);
  if (!isActorHistoryResponse(ended)) throw new Error("Invalid actor history");
  expect(ended.history.end).toMatchObject({ status: "done", output: { outcome: "done" } });
  const receipts = ended.history.events.filter(
    (event) =>
      event.type === "github.project-item.field-changed" &&
      (event.payload as { movedBy?: { confirmed?: boolean } }).movedBy?.confirmed === true,
  );
  expect(receipts).toHaveLength(1);
  expect(receipts[0]).toMatchObject({
    payload: { to: { name: "In Progress" }, movedBy: { confirmed: true } },
    visit: expect.any(Number),
    consumedAt: expect.any(String),
  });
  expect(
    ended.history.events.some(
      (event) =>
        event.type === "github.project-item.field-changed" &&
        (event.payload as { to?: { name?: string } }).to?.name === "Done",
    ),
  ).toBe(false);
  const migratedVisit = ended.history.visits.findIndex(
    (visit) => visit.blueprint?.commit === blueprintSaved.commit,
  );
  expect(migratedVisit).toBeGreaterThan(0);
  expect(ended.history.visits[migratedVisit]).toMatchObject({
    value: beforeMigration.snapshot.value,
  });
  expect(ended.history.visits[migratedVisit - 1]).not.toHaveProperty("exitEvent");
  expect(ended.history.commands.map((command) => command.kind)).toEqual([
    "thread-create",
    "turn-start",
  ]);
  // The host reads a provider session and T3 Code's durable session-to-thread mapping.
  const t3home = join(f.directory, "t3-home");
  await fs.mkdir(join(t3home, "userdata"), { recursive: true });
  const db = new DatabaseSync(join(t3home, "userdata/state.sqlite"));
  db.exec(
    "CREATE TABLE provider_session_runtime (thread_id TEXT, provider_name TEXT, provider_instance_id TEXT, resume_cursor_json TEXT)",
  );
  db.prepare("INSERT INTO provider_session_runtime VALUES (?,?,?,?)").run(
    thread.id,
    "codex",
    "provider",
    JSON.stringify({ threadId: "root-a" }),
  );
  db.close();
  const usageRoot = join(f.directory, "usage");
  await fs.mkdir(join(usageRoot, "sessions"), { recursive: true });
  const usage = await readFile(
    new URL("../../host-cli/src/usage/fixtures/codex/sessions/root.jsonl", import.meta.url),
    "utf8",
  );
  await writeFile(
    join(usageRoot, "sessions/root.jsonl"),
    usage.replaceAll(/2026-01-01T00:00:(?:00|10)Z/g, usedAt),
  );
  const pushArgs = [
    "usage",
    "push",
    "--service",
    f.url,
    "--environment",
    "workstation",
    "--t3-home",
    t3home,
    "--state-dir",
    join(f.directory, "host-state"),
    "--root",
    "codex=" + usageRoot,
  ];
  const pushed = await promisify(execFile)(childArtifacts().host, pushArgs);
  expect(JSON.parse(pushed.stdout)).toMatchObject({
    calls: { accepted: 1, pending: 0 },
    threads: { accepted: 1 },
  });
  expect(f.portfolio.ledger.actorUsage("task:I_A")).toMatchObject({
    settled: true,
    accounts: [{ account: "agents", estimate: 10, actual: 10, variance: 0, outstanding: 0 }],
  });
  expect(grantedToken()).toEqual(token);
  const response = await fetch(f.url + "/api/tasks/" + encodeURIComponent("task:I_A"));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(isTaskResponse(body), JSON.stringify(body)).toBe(true);
  expect(body).toMatchObject({
    task: {
      actorId: "task:I_A",
      actor: { status: "done" },
      threads: [{ threadId: thread.id }],
      usage: {
        settled: true,
        accounts: [{ account: "agents", estimate: 10, actual: 10, variance: 0, reserved: 0 }],
      },
    },
  });
  // A separate provider session maps to a thread that no task owns.
  const unownedThread = "unowned-parcel-thread";
  const mappingDb = new DatabaseSync(join(t3home, "userdata/state.sqlite"));
  mappingDb
    .prepare("INSERT INTO provider_session_runtime VALUES (?,?,?,?)")
    .run(unownedThread, "codex", "provider", JSON.stringify({ threadId: "unowned-session" }));
  mappingDb.close();
  await writeFile(
    join(usageRoot, "sessions/unowned.jsonl"),
    usage
      .replaceAll("root-a", "unowned-session")
      .replaceAll(/2026-01-01T00:00:(?:00|10)Z/g, usedAt),
  );
  const unownedPush = await promisify(execFile)(childArtifacts().host, pushArgs);
  expect(JSON.parse(unownedPush.stdout)).toMatchObject({ calls: { accepted: 1, pending: 0 } });
  const from = `thread:workstation:${unownedThread}`;
  expect(await get("/api/usage/unowned")).toMatchObject({
    unowned: [
      expect.objectContaining({
        actor: from,
        threadId: unownedThread,
        usage: [expect.objectContaining({ account: "agents", amount: 8, calls: 1 })],
      }),
    ],
  });
  expect(await post("/api/usage/moves", { from, to: { actor: "task:I_A" } })).toMatchObject({
    status: "moved",
    moved: 1,
    accounts: [{ account: "agents", amount: 8 }],
  });
  const movedTask = await get("/api/tasks/task%3AI_A");
  expect(isTaskResponse(movedTask)).toBe(true);
  expect(movedTask).toMatchObject({
    task: {
      usage: { settled: true, accounts: [{ estimate: 10, actual: 18, variance: 8, reserved: 0 }] },
    },
  });
  expect(await get("/api/usage/unowned")).toEqual({ unowned: [] });
  expect(await post("/api/usage/moves", { from, to: { actor: "task:I_A" } })).toMatchObject({
    moved: 0,
  });
  const replayed = await promisify(execFile)(childArtifacts().host, pushArgs);
  expect(JSON.parse(replayed.stdout)).toMatchObject({ calls: { accepted: 0 } });
  expect(f.t3.commands.map((command) => command.type)).toEqual([
    "thread.create",
    "thread.turn.start",
    "project.create",
  ]);
  expect(f.moves()).toEqual(["In Progress", "Done"]);
  expect(f.t3.threads.size).toBe(1);
  expect(f.notifications).toEqual([]);
  const source = await get("/api/declarations/source?path=portfolio.yml");
  const edited = parse(source.text);
  edited.items.work.allocations.agents.guarantee = 80;
  const text = stringify(edited);
  const saved = await post("/api/declarations/save", {
    path: "portfolio.yml",
    base: source.commit,
    text,
    message: "Change sample allocation",
    saveId: "1".repeat(32),
  });
  expect(saved).toMatchObject({ outcome: "saved", commit: expect.any(String) });
  expect(saved.commit).not.toBe(source.commit);
  expect(await get("/api/declarations/source?path=portfolio.yml")).toMatchObject({
    commit: saved.commit,
    text,
  });
  expect(await get("/api/portfolio")).toMatchObject({
    commit: saved.commit,
    items: expect.arrayContaining([
      expect.objectContaining({
        id: "work",
        allocations: [expect.objectContaining({ account: "agents", guarantee: 80 })],
      }),
    ]),
  });
  const remoteHead = await git.resolveRef({ fs, gitdir: f.remote.gitdir, ref: "main" });
  expect(remoteHead).toBe(saved.commit);
  expect(
    Buffer.from(
      (
        await git.readBlob({
          fs,
          gitdir: f.remote.gitdir,
          oid: remoteHead,
          filepath: "portfolio.yml",
        })
      ).blob,
    ).toString(),
  ).toBe(text);
  await f.restart();
  expect(await get("/api/portfolio")).toMatchObject({
    commit: saved.commit,
    items: expect.arrayContaining([
      expect.objectContaining({
        id: "work",
        allocations: [expect.objectContaining({ account: "agents", guarantee: 80 })],
      }),
    ]),
  });
  expect(await get("/api/actors/task%3AI_A/history")).toEqual(ended);
  expect(await get("/api/tasks/task%3AI_A")).toMatchObject({
    task: { usage: { settled: true, accounts: [{ actual: 18, variance: 8 }] } },
  });
  const attachedCreated = (await get("/api/declarations/bindings")).createdProjects;
  const archive = await post("/api/declarations/archive-item", {
    item: "work",
    projects: [
      { binding: "work-board", choice: "archive" },
      ...attachedCreated.map((p: { environment: string; project: string }, i: number) => ({
        created: { environment: p.environment, project: p.project },
        name: `sample-created-${i + 1}`,
        choice: "archive",
      })),
    ],
    base: saved.commit,
    message: "Archive sample portfolio",
    saveId: "3".repeat(32),
  });
  expect(archive).toMatchObject({ outcome: "saved", commit: expect.any(String) });
  expect(await get("/api/portfolio")).toMatchObject({
    commit: archive.commit,
    items: expect.arrayContaining([
      expect.objectContaining({ id: "work", archived: true, projects: { github: [], t3code: [] } }),
    ]),
  });
  expect(
    parse((await get("/api/declarations/source?path=portfolio.yml")).text).items.work.archived,
  ).toBe(true);
  expect(
    parse((await get("/api/declarations/source?path=bindings.yml")).text).githubProjects[
      "work-board"
    ].archived,
  ).toBe(true);
  await f.restart();
  expect(await get("/api/portfolio")).toMatchObject({
    commit: archive.commit,
    items: expect.arrayContaining([expect.objectContaining({ id: "work", archived: true })]),
  });
  f.worker.send("stop");
  expect(await f.exited).toBe(0);
}, 120000);
it("retries a settled turn in the same thread and creates a replacement after a stalled thread is deleted", async () => {
  const f = await fixture();
  await f.add();
  await f.waiting();
  const thread = [...f.t3.threads.values()][0]!;
  f.t3.settle(thread.id);
  await expect.poll(f.state).toEqual({ active: "stalled" });
  await expect.poll(() => f.notifications.length).toBe(1);
  const row = f.store.connection.database
    .prepare("SELECT escalation_id FROM escalation WHERE kind IS NULL")
    .get();
  expect(row).toBeDefined();
  // The callback's public answer path is exercised by the escalation API below.
  const id = String(row!["escalation_id"]);
  expect(
    (
      await fetch(f.url + `/api/escalations/${id}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ choice: "retry" }),
      })
    ).status,
  ).toBe(200);
  await f.waiting();
  expect(thread.messages).toHaveLength(2);
  expect(f.t3.threads.size).toBe(1);
  f.t3.settle(thread.id);
  await expect.poll(f.state).toEqual({ active: "stalled" });
  thread.deletedAt = new Date().toISOString();
  f.t3.change(thread, "thread.deleted", { threadId: thread.id });
  await expect.poll(() => (f.snapshot()!["context"] as { thread: string }).thread).toBe("");
  const retry = f.store.connection.database
    .prepare("SELECT escalation_id FROM escalation WHERE kind IS NULL AND status = 'open'")
    .get();
  expect(
    (
      await fetch(f.url + `/api/escalations/${retry!["escalation_id"]}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ choice: "retry" }),
      })
    ).status,
  ).toBe(200);
  await f.waiting();
  expect(f.t3.commands.filter((c) => c.type === "thread.create")).toHaveLength(2);
  await f.handoff();
});
it.each(["new", "joined", "unknown"] as const)(
  "tracks an agent escalation's %s answer turn",
  async (mode) => {
    const f = await fixture();
    await f.add();
    await f.waiting();
    const thread = [...f.t3.threads.values()][0]!;
    const asking = thread.latestTurn!.turnId;
    const questionResponse = await f.agentCall("escalate", {
      thread: thread.id,
      title: "Parcel question",
      question: "Use the large box?",
      freeText: true,
    });
    expect(questionResponse.status).toBe(200);
    const question = (await questionResponse.json()) as { escalationId: string };
    await expect.poll(f.state).toEqual({ active: { working: "escalated" } });
    await expect.poll(() => f.notifications.length).toBe(1);
    if (mode === "new") {
      f.t3.settle(thread.id);
      await expect.poll(() => f.store.pendingInbox("task:I_A").length).toBe(0);
      expect(f.state()).toEqual({ active: { working: "escalated" } });
    } else {
      const dispatch = f.t3.hooks.dispatch!;
      f.t3.hooks.dispatch = (raw) => {
        const command = schemas.orchestrationCommands.ClientOrchestrationCommand.parse(raw);
        if (command.type !== "thread.turn.start") return dispatch(raw);
        if (mode === "unknown") throw new Error("Fixture answer refused");
        const message = schemas.orchestrationReadModel.OrchestrationMessage.parse({
          id: command.message.messageId,
          role: "user",
          turnId: null,
          streaming: false,
          text: command.message.text,
          attachments: [],
          createdAt: command.createdAt,
          updatedAt: command.createdAt,
        });
        thread.messages.push(message);
        f.t3.change(thread, "thread.message-sent", {
          threadId: thread.id,
          ...message,
          messageId: message.id,
        });
        return { sequence: f.t3.log.length };
      };
    }
    expect(
      (
        await fetch(f.url + "/api/escalations/" + question.escalationId + "/answer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: "Use it" }),
        })
      ).status,
    ).toBe(200);
    await f.waiting();
    const context = f.snapshot()!["context"] as { answerTurn: string | null };
    if (mode === "unknown") expect(context.answerTurn).toBeNull();
    else {
      expect(context.answerTurn).toBe(thread.latestTurn!.turnId);
      if (mode === "joined") expect(context.answerTurn).toBe(asking);
      else expect(context.answerTurn).not.toBe(asking);
      expect(thread.messages).toHaveLength(2);
      expect(thread.messages[1]!.text).toContain("Use it");
    }
    f.t3.settle(thread.id);
    if (mode === "unknown") {
      await expect.poll(() => f.store.pendingInbox("task:I_A").length).toBe(0);
      expect(f.state()).toEqual({ active: { working: "waiting" } });
      expect(
        f.store.connection.database
          .prepare("SELECT COUNT(*) AS n FROM escalation WHERE kind IS NULL AND status = 'open'")
          .get()?.["n"],
      ).toBe(0);
    } else {
      await expect.poll(f.state).toEqual({ active: "stalled" });
      await expect
        .poll(
          () =>
            f.store.connection.database
              .prepare(
                "SELECT COUNT(*) AS n FROM escalation WHERE kind IS NULL AND status = 'open'",
              )
              .get()?.["n"],
        )
        .toBe(1);
    }
    await f.handoff();
  },
);
it("holds a refused card move and retries from the saved moving state", async () => {
  const f = await fixture(true);
  await f.add();
  await expect.poll(() => f.store.loadErroredSnapshot("task:I_A")?.snapshot.status).toBe("error");
  expect(f.state()).toBe("starting");
  expect(f.t3.threads.size).toBe(0);
  expect(f.portfolio.ledger.actorUsage("task:I_A").settled).toBe(false);
  await expect
    .poll(() =>
      f.store.connection.database
        .prepare(
          "SELECT escalation_id FROM escalation WHERE kind = 'held-actor' AND status = 'open'",
        )
        .get(),
    )
    .toBeDefined();
  const escalation = f.store.connection.database
    .prepare("SELECT escalation_id FROM escalation WHERE kind = 'held-actor' AND status = 'open'")
    .get()!;
  expect(
    (
      await fetch(f.url + `/api/escalations/${escalation["escalation_id"]}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ choice: "retry" }),
      })
    ).status,
  ).toBe(200);
  await f.waiting();
  await f.handoff();
  expect(f.moves()).toEqual(["In Progress", "In Progress", "Done"]);
  expect(f.t3.threads.size).toBe(1);
});

it("keeps the ended starter actor history, confirmed card receipts and measured growth", async () => {
  const f = await fixture();
  await f.add();
  await f.waiting();
  await f.handoff();
  await expect
    .poll(() =>
      f.store.connection.database
        .prepare("SELECT * FROM github_card_move WHERE actor_id=?")
        .all("task:I_A"),
    )
    .toEqual([]);
  const response = await fetch(
    f.url + "/api/actors/" + encodeURIComponent("task:I_A") + "/history",
  );
  expect(response.status).toBe(200);
  const { isActorHistoryResponse, isActorsResponse } =
    await import("@wyrd-company/manifold-shared/actors-api");
  const body = await response.json();
  expect(isActorHistoryResponse(body)).toBe(true);
  if (!isActorHistoryResponse(body)) throw new Error("Invalid actor history");
  const h = body.history;
  expect(h.end).toMatchObject({
    status: "done",
    output: { outcome: "done", handoff: { summary: "Parcel packed" } },
  });
  expect(h.visits.length).toBeGreaterThan(3);
  for (const visit of h.visits)
    expect(visit.blueprint).toEqual({ path: "blueprints/task.yml", commit: f.commit });
  expect(h.commands.map((c) => c.kind)).toEqual(["thread-create", "turn-start"]);
  expect(h.commands[1]).not.toHaveProperty("turnId");
  const thread = [...f.t3.threads.values()][0]!;
  expect(h.commands.map((c) => c.invokeId)).toEqual(["open-thread", "start-turn"]);
  expect(
    h.commands.every(
      (c) =>
        c.environment === "workstation" &&
        c.threadId === thread.id &&
        /^[1-9][0-9]*$/.test(c.entryId),
    ),
  ).toBe(true);
  expect(h.commands[1]!.messageId).toBe(thread.messages[0]!.id);
  expect(h.commands.map((c) => c.commandId)).toEqual(f.t3.commands.map((c) => c.commandId));
  expect(h.commands.every((c) => c.acceptedAt)).toBe(true);
  const receipts = h.events.filter(
    (e) =>
      e.type === "github.project-item.field-changed" &&
      (e.payload as { movedBy?: { confirmed?: boolean } }).movedBy?.confirmed,
  );
  expect(receipts).toHaveLength(1);
  expect(f.moves()).toEqual(["In Progress", "Done"]);
  expect(receipts[0]!.payload).toMatchObject({ to: { name: "In Progress" } });
  expect(
    h.events.some(
      (e) =>
        e.type === "github.project-item.field-changed" &&
        (e.payload as { to?: { name?: string } }).to?.name === "Done",
    ),
  ).toBe(false);
  expect(receipts.every((e) => e.visit !== undefined && e.consumedAt !== undefined)).toBe(true);
  const completed = await (await fetch(f.url + "/api/actors?status=completed")).json();
  expect(isActorsResponse(completed)).toBe(true);
  expect(completed).toMatchObject({ actors: expect.arrayContaining([{ ...h.actor }]) });
  const db = f.store.connection.database;
  const growth = Object.fromEntries(
    ["history_visit", "history_event", "history_command", "store_inbox"].map((table) => {
      const rows = db.prepare(`SELECT * FROM ${table} WHERE actor_id=?`).all("task:I_A");
      // Logical column bytes: UTF-8 text and decimal integers, null costs zero.
      const bytes = rows.reduce(
        (sum, row) =>
          sum +
          Object.values(row).reduce<number>(
            (n, value) => n + (value === null ? 0 : Buffer.byteLength(String(value))),
            0,
          ),
        0,
      );
      return [table, { rows: rows.length, bytes }];
    }),
  );
  console.log("ACTOR_HISTORY_GROWTH " + JSON.stringify(growth));
  await f.restart();
  expect(
    await (
      await fetch(f.url + "/api/actors/" + encodeURIComponent("task:I_A") + "/history")
    ).json(),
  ).toEqual(body);
});
it.each(["event", "command"] as const)(
  "SIGKILL at the %s boundary converges to one linked event and one server turn",
  async (boundary) => {
    const f = await fixture(false, boundary);
    await f.add();
    await f.resumeKilled();
    await f.waiting();
    expect(f.faults[0]!.boundary).toBe(boundary);
    const thread = [...f.t3.threads.values()][0]!;
    expect(thread.messages).toHaveLength(1);
    expect(f.t3.threads.size).toBe(1);
    await f.handoff();
    const { isActorHistoryResponse } = await import("@wyrd-company/manifold-shared/actors-api");
    const body = await (
      await fetch(f.url + "/api/actors/" + encodeURIComponent("task:I_A") + "/history")
    ).json();
    expect(isActorHistoryResponse(body)).toBe(true);
    if (!isActorHistoryResponse(body)) throw new Error("Invalid actor history");
    const starts = body.history.events.filter(
      (e) =>
        e.type === "github.project-item.field-changed" &&
        (e.payload as { movedBy?: { confirmed?: boolean } }).movedBy?.confirmed === true,
    );
    expect(starts).toHaveLength(1);
    expect(starts[0]).toMatchObject({ visit: expect.any(Number), consumedAt: expect.any(String) });
    expect(
      f.store.connection.database
        .prepare("SELECT * FROM history_event WHERE actor_id=? AND event_id=?")
        .all("task:I_A", starts[0]!.eventId),
    ).toHaveLength(1);
    expect(body.history.commands.filter((c) => c.kind === "turn-start")).toHaveLength(1);
    expect(body.history.commands[1]).toMatchObject({
      acceptedAt: expect.any(String),
    });
  },
);

it("lints the UAT project-and-message blueprint with the compiled host CLI", async () => {
  const result = await promisify(execFile)(childArtifacts().host, [
    "blueprint",
    "lint",
    new URL("../../../testing/uat/blueprints/project-and-message.yml", import.meta.url).pathname,
  ]);
  expect(result.stdout).toBe("");
  expect(result.stderr).toBe("");
});

it("applies all five additional storage kinds from the starter, observes normalized values and preserves the issue body", async () => {
  const fields = {
    priority: {
      type: "single-select",
      storage: { kind: "issue-field", name: "Urgency", organization: "sample" },
      options: ["Normal", "High"],
    },
    category: {
      type: "single-select",
      storage: { kind: "issue-type", organization: "sample" },
      options: ["Request", "Return"],
    },
    size: {
      type: "single-select",
      storage: { kind: "label", prefix: "size: " },
      options: ["Small", "Large"],
    },
    batch: { type: "single-select", storage: { kind: "milestone" }, options: ["Spring"] },
    note: { type: "text", storage: { kind: "front-matter", key: "note" } },
  };
  const values = {
    priority: "High",
    category: "Request",
    size: "Small",
    batch: "Spring",
    note: "first\0last",
  };
  const f = await fixture(
    false,
    undefined,
    (files) => {
      const metadata = parse(files.get("task-metadata.yml")!);
      Object.assign(metadata.projects["work-board"], {
        repositories: ["sample/records"],
        fields: { ...metadata.projects["work-board"].fields, ...fields },
      });
      files.set("task-metadata.yml", stringify(metadata));
      const intake = parse(files.get("decision-models/intake.yml")!);
      intake.nodes[1].content.config.rules[0].blueprint = '"blueprints/fields.yml"';
      files.set("decision-models/intake.yml", stringify(intake));
      const names = Object.keys(values);
      files.set(
        "blueprints/fields.yml",
        stringify({
          machine: {
            initial: names[0],
            states: Object.fromEntries([
              ...names.map((name, i) => [
                name,
                {
                  invoke: {
                    src: "github-task-field-set",
                    input: { field: name, value: values[name as keyof typeof values] },
                    onDone: names[i + 1] ?? "done",
                  },
                },
              ]),
              ["done", { type: "final" }],
            ]),
          },
          schemas: { input: true, context: true, output: true, events: {} },
        }),
      );
    },
    true,
  );
  const body =
    '---\n# keep this comment\nuntouched: "retained"\nnote: old\n---\n\nGeneric instructions\0continued\n';
  f.api.editBody("I_A", body, false);
  const get = async (path: string) => (await fetch(f.url + path)).json();
  const post = async (path: string, body: unknown) => {
    const response = await fetch(f.url + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const answer = await response.json();
    expect(response.status, JSON.stringify(answer)).toBe(200);
    return answer;
  };
  await expect
    .poll(async () => (await fetch(f.url + "/api/projects/work-board/plan")).status)
    .toBe(200);
  const plan = await get("/api/projects/work-board/plan");
  expect(plan.scopes.map((s: { scope: { kind: string } }) => s.scope.kind).sort()).toEqual([
    "organization",
    "repository",
  ]);
  expect(
    await post("/api/projects/work-board/apply", { digest: plan.digest, removeUndeclared: false }),
  ).toMatchObject({ configuration: { state: "in-sync" } });
  expect(f.organization!.fields.map((field) => field.name)).toEqual(["Urgency"]);
  expect(f.organization!.types.map((type) => type.name)).toEqual(["Request", "Return"]);
  expect(f.repository!.labels().map((label) => label.name)).toContain("size: Small");
  const observation = f.holdBodyObservation();
  await f.add();
  const held = await observation;
  await held.reached;
  await expect.poll(f.state, { timeout: 15000 }).toBe("done");
  expect(parse(f.api.issues.get("I_A")!.body!.split("---")[1]!).note).toBe(values.note);
  // Completion confirms the write, while the queued mirror read is still held.
  let task = await get("/api/tasks/task%3AI_A");
  expect(task.task.projects[0].fields).toContainEqual(
    expect.objectContaining({ name: "note", value: { state: "set", value: "old" } }),
  );
  held.release();
  await expect
    .poll(async () => {
      task = await get("/api/tasks/task%3AI_A");
      return task.task.projects[0].fields;
    })
    .toEqual(
      expect.arrayContaining(
        Object.entries(values).map(([name, value]) =>
          expect.objectContaining({ name, value: { state: "set", value } }),
        ),
      ),
    );
  expect(f.repository!.assigned()).toEqual(["personal", "size: Small"]);
  const updated = f.api.issues.get("I_A")!.body!;
  expect(updated).toContain("# keep this comment");
  expect(updated).toContain('untouched: "retained"');
  expect(updated.slice(updated.indexOf("\n---\n"))).toBe(body.slice(body.indexOf("\n---\n")));
  expect(parse(updated.split("---")[1]!).note).toBe(values.note);
  await f.restart();
  expect((await get("/api/tasks/task%3AI_A")).task.projects[0].fields).toEqual(
    task.task.projects[0].fields,
  );
  expect(await post("/api/projects/work-board/apply", { removeUndeclared: false })).toMatchObject({
    writes: 0,
  });

  // Both owners declare the same organization entity with incompatible options.
  const bindings = parse(f.files.get("bindings.yml")!);
  bindings.githubProjects.secondary = { ...bindings.githubProjects["work-board"], number: 2 };
  const metadata = parse(f.files.get("task-metadata.yml")!);
  metadata.projects.secondary = {
    lifecycle: metadata.projects["work-board"].lifecycle,
    fields: { priority: { ...fields.priority, options: ["Different"] } },
  };
  const before = {
    project: f.api.log.length,
    organization: f.organization!.log.length,
    repository: f.repository!.calls.length,
  };
  const response = await fetch(f.url + "/api/declarations/save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      base: f.commit,
      saveId: "a".repeat(32),
      message: "Conflicting sample owners",
      path: "task-metadata.yml",
      text: stringify(metadata),
    }),
  });
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({
    findings: expect.arrayContaining([expect.objectContaining({ kind: "shared-conflict" })]),
  });
  expect(
    f.api.log
      .slice(before.project)
      .filter((row) => /Write|Create|Update|Delete|Move|Set/.test(row.operation)),
  ).toEqual([]);
  expect(
    f
      .organization!.log.slice(before.organization)
      .filter((row) => /Write|Update|Delete|Value/.test(row.operation)),
  ).toEqual([]);
  expect(
    f.repository!.calls.slice(before.repository).filter((row) => row.method !== "GET"),
  ).toEqual([]);
  expect(await git.resolveRef({ fs, gitdir: f.remote.gitdir, ref: "main" })).toBe(f.commit);
}, 60000);

it("applies a JDM edit to a durable draft, publishes both files and invokes the committed model through the service", async () => {
  const f = await fixture();
  const path = "blueprints/quote.yml";
  const modelPath = "decision-models/quote.yml";
  const model = {
    nodes: [
      { id: "in", type: "inputNode" },
      {
        id: "calc",
        type: "customNode",
        content: { kind: "jsonataExpression", config: { expression: '{"price": size * 2}' } },
      },
      { id: "out", type: "outputNode" },
    ],
    edges: [
      { id: "a", sourceId: "in", targetId: "calc" },
      { id: "b", sourceId: "calc", targetId: "out" },
    ],
  };
  const baseText = "# retained model comment\n" + stringify(model);
  const prepared = prepareModel(model);
  prepared.model.nodes[1]!.content.config.expression =
    '{"price": size * 3, "note": "first\\u0000last"}';
  const text = writeModel(baseText, prepared.authored(prepared.model));
  const blueprint = stringify({
    machine: {
      initial: "quote",
      context: { result: null },
      states: {
        quote: {
          invoke: {
            src: modelPath,
            input: { size: 4 },
            onDone: {
              target: "done",
              actions: {
                type: "expression.assign",
                params: { expression: '{"result": event.output}' },
              },
            },
          },
        },
        done: { type: "final" },
      },
    },
    schemas: {
      input: true,
      output: true,
      context: true,
      events: {},
      actors: {
        [modelPath]: {
          input: { type: "object", properties: { size: { type: "number" } }, required: ["size"] },
          output: {
            type: "object",
            properties: { price: { type: "number" }, note: { type: "string" } },
            required: ["price", "note"],
          },
        },
      },
    },
  });
  const draft = applyModelDraft({ base: f.commit, baseText: "", text: blueprint }, modelPath, {
    baseText: "",
    text,
    exists: false,
  });
  expect(draft.text).toBe(blueprint);
  expect(text).toContain("# retained model comment");
  const entries = new Map<string, string>();
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
  };
  writeDraft(storage, path, draft);
  expect(readDraft(storage, path)).toEqual(draft);
  const recovered = readDraft(storage, path)!;
  const intake = parse(f.files.get("decision-models/intake.yml")!);
  intake.nodes[1].content.config.rules[0].blueprint = '"blueprints/quote.yml"';
  const request = {
    base: recovered.base,
    files: [
      ...changedFiles(path, recovered, true).map(({ path, text }) => ({ path, text })),
      { path: "decision-models/intake.yml", text: stringify(intake) },
    ],
    saveId: "b".repeat(32),
    message: "Publish sample model",
  };
  const publish = () =>
    fetch(f.url + "/api/declarations/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
  const saved = await publish();
  const answer = await saved.json();
  expect(saved.status, JSON.stringify(answer)).toBe(200);
  expect(answer).toMatchObject({ outcome: "saved", loaded: true });
  expect(await (await publish()).json()).toMatchObject({
    outcome: "already-saved",
    commit: answer.commit,
  });
  // Drafts stay until the published sources have both been observed.
  const pending = { ...recovered, saved: answer.commit };
  expect(settleModelDraft(pending, { commit: answer.commit, text: blueprint }, {}, true)).toEqual(
    pending,
  );
  const source = await (
    await fetch(
      f.url + `/api/declarations/decision-model?path=${modelPath}&commit=${answer.commit}`,
    )
  ).json();
  expect(source).toMatchObject({ text, exists: true, commit: answer.commit });
  expect(
    settleModelDraft(
      pending,
      { commit: answer.commit, text: blueprint },
      { [modelPath]: { text: source.text, exists: source.exists } },
      true,
    ),
  ).toBeUndefined();
  await f.add();
  await expect.poll(f.snapshot, { timeout: 15000 }).toMatchObject({
    status: "done",
    value: "done",
    context: { result: { price: 12, note: "first\0last" } },
  });
  expect(f.store.loadSnapshot("task:I_A")!.machine).toContain(answer.commit);
  await f.restart();
  expect(f.snapshot()).toMatchObject({ context: { result: { price: 12, note: "first\0last" } } });
  expect(
    (await git.log({ fs, gitdir: f.remote.gitdir, ref: "main" })).filter((row) =>
      row.commit.message.startsWith("Publish sample model"),
    ),
  ).toHaveLength(1);
}, 60000);

it("checks intake records and grants a populated issue graph with one mirror read per pass", async () => {
  const f = await fixture(false, undefined, (files) => {
    files.set(
      "blueprints/graph.yml",
      stringify({
        machine: {
          initial: "waiting",
          states: {
            waiting: {
              meta: { gate: { comparator: "comparators/graph.ts", return: "exit" } },
              on: { token: "done" },
            },
            done: { type: "final" },
          },
        },
        schemas: { input: true, output: true, context: true, events: {} },
      }),
    );
    files.set(
      "comparators/graph.ts",
      "export default i => i.holders.length >= 5 ? null : { task: [...i.population].sort((a,b) => b.criticalPath-a.criticalPath || a.id.localeCompare(b.id))[0].id };",
    );
  });
  await f.add();
  await f.waiting();
  const result = await f.requestWorker("graph", { size: 32 });
  expect(result).toMatchObject({ intakeReads: 1, gateReads: 1, family: ["graph-2"] });
  expect(result["records"]).toHaveLength(32);
  expect(result["records"]).toEqual(
    expect.arrayContaining([expect.objectContaining({ status: "failed", attempts: 1 })]),
  );
  expect(result["scheduled"]).toEqual([
    "member:graph-0",
    "member:graph-1",
    "member:graph-3",
    "member:graph-4",
    "member:graph-10",
  ]);
  const evaluations = result["evaluations"] as {
    population: { id: string; criticalPath: number }[];
  }[];
  expect(evaluations).toHaveLength(6);
  const lengths = new Map(evaluations[0]!.population.map((p) => [p.id, p.criticalPath]));
  expect(lengths.get("member:graph-0")).toBe(3);
  expect(lengths.get("member:graph-1")).toBe(2);
  expect(lengths.get("member:graph-3")).toBe(2);
  expect(lengths.get("member:graph-4")).toBe(2);
  expect(lengths.get("member:graph-10")).toBe(1);
  for (const evaluation of evaluations.slice(1))
    for (const member of evaluation.population)
      expect(member.criticalPath).toBe(lengths.get(member.id));
}, 60000);

it("creates projects, archives with every choice, recovers an open tool operation and retains attribution after convergent pruning", async () => {
  const f = await fixture(false, undefined, (files) => {
    const task = parse(shippedBundle.files.get("blueprints/task.yml")!);
    task.machine.initial = "create-one";
    for (const [i, name] of ["one", "two", "three"].entries()) {
      task.machine.context[name] = "";
      task.schemas.context.properties[name] = { type: "string" };
      task.machine.states["create-" + name] = {
        invoke: {
          src: "t3code-project-create",
          input: {
            title: "Sample " + name,
            workspaceRoot: "/tmp/sample-" + name,
            createWorkspaceRoot: true,
          },
          onDone: {
            target: ["create-two", "create-three", "todo"][i],
            actions: {
              type: "expression.assign",
              params: { expression: `{"${name}": event.output.projectId}` },
            },
          },
        },
      };
    }
    task.machine.states["create-one"].entry = task.machine.states.todo.entry;
    delete task.machine.states.todo.entry;
    task.schemas.actors["t3code-project-create"] = {
      input: true,
      output: {
        type: "object",
        properties: { projectId: { type: "string" } },
        required: ["projectId"],
      },
    };
    files.set("blueprints/task.yml", stringify(task));
    files.set(
      "blueprints/notice.yml",
      stringify({
        machine: {
          initial: "create",
          states: {
            create: {
              invoke: {
                src: "t3code-project-create",
                input: {
                  title: "Sample eligible",
                  workspaceRoot: "/tmp/sample-eligible",
                  createWorkspaceRoot: true,
                },
                onDone: "done",
              },
            },
            done: { type: "final" },
          },
        },
        schemas: { input: true, output: true, context: true, events: {} },
      }),
    );
    const portfolio = parse(files.get("portfolio.yml")!);
    portfolio.items = {
      group: {
        allocations: { agents: { guarantee: 100 } },
        items: { work: portfolio.items.work, destination: {} },
      },
    };
    files.set("portfolio.yml", stringify(portfolio));
  });
  const post = async (path: string, body: unknown) => {
    const response = await fetch(f.url + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const answer = await response.json();
    expect(response.status, JSON.stringify(answer)).toBe(200);
    return answer;
  };
  const get = async (path: string) => (await fetch(f.url + path)).json();
  await f.add();
  await f.waiting();
  await f.add("I_B", "item-two");
  await expect.poll(() => f.store.loadSnapshot("task:I_B")?.snapshot.status).toBe("done");
  const projects = [...f.t3.commands].filter((command) => command.type === "project.create");
  expect(projects).toHaveLength(4);
  const ids = projects.slice(0, 3).map((command) => command.projectId);
  const eligible = projects[3]!.projectId;
  const thread = [...f.t3.threads.values()][0]!;
  const unowned = ids.map((projectId, i) => {
    const thread = fixtureThread(`unowned-${i}`);
    thread.projectId = projectId;
    f.t3.change(thread);
    return thread;
  });
  await expect
    .poll(
      () =>
        f.store.connection.database
          .prepare("SELECT count(*) n FROM t3_thread WHERE thread_id LIKE 'unowned-%'")
          .get()?.["n"],
    )
    .toBe(3);
  const seeded = await f.requestWorker("retention-fixture");
  expect(seeded).toMatchObject({ closed: expect.any(String) });
  const timestamp = new Date().toISOString();
  const call = (key: string, session: string) => ({
    ...sampleCall(key, session),
    timestamp,
    model: "sample-model",
  });
  const mapping = (session: string, threadId: string) => ({
    provider: "codex",
    providerSessionId: session,
    threadId,
  });
  const push = (records: unknown[], threads: unknown[] = []) =>
    post("/api/usage/push", { environment: "workstation", records, threads });
  await push(
    [call("before\0whole", "known"), call("late\0whole", "late")],
    [mapping("known", unowned[0]!.id)],
  );
  const db = f.store.connection.database;
  expect(
    db.prepare("SELECT item FROM usage_postings WHERE call_key=?").get("before\0whole")?.["item"],
  ).toBe("work");
  const questionResponse = await f.agentCall("escalate", {
    thread: thread.id,
    title: "Sample question",
    question: "First\0last?",
    freeText: true,
  });
  expect(questionResponse.status).toBe(200);
  const question = await questionResponse.json();
  await expect.poll(f.state).toEqual({ active: { working: "escalated" } });
  const beforeKill = f.store.loadSnapshot("task:I_A")!;
  expect((await get(`/api/escalations/${question.escalationId}`)).question).toBe("First\0last?");
  await f.restart();
  expect(f.store.loadSnapshot("task:I_A")!.machine).toBe(beforeKill.machine);
  expect(f.state()).toEqual(beforeKill.snapshot.value);
  expect(await get(`/api/escalations/${question.escalationId}`)).toMatchObject({
    status: "open",
    question: "First\0last?",
  });
  expect(db.prepare("SELECT escalation_id FROM agenttool_question").get()?.["escalation_id"]).toBe(
    question.escalationId,
  );
  expect((await get("/api/declarations/bindings")).createdProjects).toHaveLength(4);
  const request = {
    item: "work",
    base: f.commit,
    saveId: "c".repeat(32),
    message: "Archive sample item",
    projects: [
      { binding: "work-board", choice: "move" },
      ...ids.map((project, i) => ({
        created: { environment: "workstation", project },
        name: `created-${i}`,
        choice: ["move", "reassign", "archive"][i],
        ...(i === 1 ? { item: "destination" } : {}),
      })),
      {
        created: { environment: "workstation", project: eligible },
        name: "eligible",
        choice: "archive",
      },
    ],
  };
  const archive = await post("/api/declarations/archive-item", request);
  expect(archive.outcome).toBe("saved");
  expect(await post("/api/declarations/archive-item", request)).toMatchObject({
    outcome: "already-saved",
    commit: archive.commit,
  });
  for (const [i, thread] of unowned.entries())
    await push([call(`after-${i}`, `session-${i}`)], [mapping(`session-${i}`, thread.id)]);
  await push([], [mapping("late", unowned[0]!.id)]);
  const items = ["group/other", "destination", "work"];
  for (const [i, item] of items.entries())
    expect(
      db.prepare("SELECT item FROM usage_postings WHERE call_key=?").get(`after-${i}`)?.["item"],
    ).toBe(item);
  expect(
    db.prepare("SELECT item FROM usage_postings WHERE call_key=?").get("before\0whole")?.["item"],
  ).toBe("work");
  expect(
    db
      .prepare("SELECT attributed_item FROM usage_attributed_postings WHERE call_key=?")
      .get("late\0whole")?.["attributed_item"],
  ).toBe("group/other");
  const beforePrune = await get("/api/usage/unowned");
  f.t3.removeProject(eligible);
  await expect
    .poll(async () =>
      (await get("/api/declarations/bindings")).createdProjects.some(
        (p: { project: string }) => p.project === eligible,
      ),
    )
    .toBe(false);
  await f.restart(async () => {
    // Age the real ended actor, delivery and operation rows with the service stopped.
    db.prepare("UPDATE store_snapshot SET saved_at=1 WHERE actor_id='task:I_B'").run();
    db.exec(
      "INSERT INTO github_delivery VALUES('expired-delivery',99,'issues',1); INSERT INTO github_redelivery VALUES('expired-redelivery',99,1,1); INSERT INTO github_hook_scan VALUES(99,2)",
    );
    db.prepare("UPDATE escalation SET raised_at=1 WHERE escalation_id=?").run(
      question.escalationId,
    );
  });
  const firstPrune = await f.requestWorker("prune");
  expect(firstPrune).toMatchObject({
    actors: 1,
    createdProjects: 1,
    deliveries: 1,
    redeliveries: 1,
    escalations: 1,
    answers: 1,
    notifications: 2,
    messages: 1,
    cardMoves: 1,
  });
  expect((await get(`/api/escalations/${seeded["closed"]}`)).error).toBeDefined();
  expect(
    db
      .prepare("SELECT CAST(text AS BLOB) text FROM agenttool_message")
      .all()
      .map((row) => Buffer.from(row["text"] as Uint8Array).toString()),
  ).toEqual(["First\0last"]);
  expect(db.prepare("SELECT actor_id FROM github_card_move").all()).toEqual([
    { actor_id: "task:I_A" },
  ]);
  expect(f.store.loadSnapshot("task:I_A")?.historyPrunedAt).toBeUndefined();
  expect(f.store.loadSnapshot("task:I_B")?.historyPrunedAt).toBeDefined();
  expect(
    db.prepare("SELECT * FROM t3_created_project WHERE project_id=?").get(eligible),
  ).toBeUndefined();
  expect(db.prepare("SELECT count(*) n FROM t3_created_project").get()?.["n"]).toBe(3);
  expect(db.prepare("SELECT escalation_id FROM agenttool_question").get()?.["escalation_id"]).toBe(
    question.escalationId,
  );
  expect((await get(`/api/escalations/${question.escalationId}`)).status).toBe("open");
  expect(await get("/api/usage/unowned")).toEqual(beforePrune);
  expect(Object.values(await f.requestWorker("prune")).every((count) => count === 0)).toBe(true);
  await f.restart();
  expect(await post("/api/declarations/archive-item", request)).toMatchObject({
    outcome: "already-saved",
    commit: archive.commit,
  });
  expect(Object.values(await f.requestWorker("prune")).every((count) => count === 0)).toBe(true);
  await push(
    [call("before\0whole", "known"), call("late\0whole", "late")],
    [mapping("late", unowned[0]!.id)],
  );
  expect(
    db
      .prepare("SELECT count(*) n FROM usage_calls WHERE call_key IN (?,?)")
      .get("before\0whole", "late\0whole")?.["n"],
  ).toBe(2);
  await push([call("after-prune", "known")]);
  expect(
    db.prepare("SELECT item FROM usage_postings WHERE call_key='after-prune'").get()?.["item"],
  ).toBe("group/other");
  const replayedQuestion = await f.agentCall("escalate", {
    thread: thread.id,
    title: "Sample question",
    question: "First\0last?",
    freeText: true,
  });
  expect(replayedQuestion.status).toBe(200);
  expect(await replayedQuestion.json()).toMatchObject({ escalationId: question.escalationId });
  await f.add("I_A", "item-one", 200);
  expect(f.state()).toEqual(beforeKill.snapshot.value);
  expect(f.t3.commands.filter((c) => c.type === "project.create")).toHaveLength(4);
  expect(
    (await git.log({ fs, gitdir: f.remote.gitdir, ref: "main" })).filter((c) =>
      c.commit.message.startsWith("Archive sample item"),
    ),
  ).toHaveLength(1);
}, 60000);
