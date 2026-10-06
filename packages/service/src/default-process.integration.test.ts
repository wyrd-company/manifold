// ---
// relationships:
//   verifies: [default-process, service-assembly, intake, gate-runtime, agent-threads, agent-tools, usage-intake, host-cli-usage, tasks-api, declarations-api, portfolio-api, projects-api]
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
const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
});
async function fixture(refuseMove = false) {
  const f = await serviceFixture();
  cleanup.push(f.close);
  await git.setConfig({ fs, gitdir: f.remote.gitdir, path: "http.receivepack", value: true });
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
  files.set(
    "blueprints/notice.yml",
    stringify({
      machine: {
        initial: "sending",
        context: {},
        states: {
          sending: {
            invoke: {
              src: "send-message",
              input: { to: { issue: "I_A" }, text: "The parcel label changed." },
              onDone: "sent",
            },
          },
          sent: { type: "final" },
        },
      },
      schemas: {
        input: true,
        output: true,
        context: true,
        events: {},
        actors: { "send-message": { input: true, output: true } },
      },
    }),
  );
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
  async function start() {
    const worker = fork(
      join(childArtifacts().service, "test-fixtures/default-process-worker.js"),
      [JSON.stringify({ file: f.file })],
      { silent: true, execArgv: [] },
    );
    let stderr = "";
    worker.on("message", (message) => {
      const value = message as { type: string; entry: unknown };
      if (value.type === "log") logs.push(value.entry);
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
  async function add(issue = "I_A", item = "item-one") {
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
    expect(
      (
        await fetch(running.url + "/webhooks/github", {
          method: "POST",
          headers: delivery.headers,
          body: delivery.body,
        })
      ).status,
    ).toBe(202);
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
    async restart() {
      running.worker.kill("SIGKILL");
      expect(await running.exited).toBeNull();
      expect(running.worker.signalCode).toBe("SIGKILL");
      running = await start();
    },
    snapshot,
    state,
    add,
    waiting,
    agentCall,
    handoff,
  };
}
it("runs the starter acceptance scenario through recovery, plugin messages, Project drift, portfolio save and settlement", async () => {
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
  await f.add();
  await f.waiting();
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
  // A second issue invokes send-message; the recipient's actor saves its routed event.
  await f.add("I_B", "item-two");
  await expect.poll(() => f.store.loadSnapshot("task:I_B")?.snapshot.status).toBe("done");
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
  await expect.poll(() => replies.find((reply) => reply["id"] === 1)).toHaveProperty("result");
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
    accounts: [{ account: "agents", estimate: 10, actual: 8, variance: -2, outstanding: 0 }],
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
        accounts: [{ account: "agents", estimate: 10, actual: 8, variance: -2, reserved: 0 }],
      },
    },
  });
  const replayed = await promisify(execFile)(childArtifacts().host, pushArgs);
  expect(JSON.parse(replayed.stdout)).toMatchObject({ calls: { accepted: 0 } });
  expect(f.t3.commands.map((command) => command.type)).toEqual([
    "thread.create",
    "thread.turn.start",
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
  f.worker.send("stop");
  expect(await f.exited).toBe(0);
}, 60000);
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
