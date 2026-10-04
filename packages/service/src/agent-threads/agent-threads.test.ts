// ---
// relationships:
//   verifies: agent-threads
// ---
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createActor, toPromise, createMachine } from "xstate";
import { afterEach, expect, test } from "vite-plus/test";
import { memoryRevision } from "@wyrd-company/manifold-shared";
import { schemas } from "@wyrd-company/t3code-client";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parse } from "yaml";
import { openAgentThreads } from "./index.ts";
import type { AgentThreadsOptions } from "./index.ts";
import { fakeServer, fixtureThread } from "../t3code-source/test-fixtures/server.ts";
const commit = "a".repeat(40);
const invocation = { actorId: "worker", invokeId: "opening", entryId: "entry-one" };
const input = {
  project: " project ",
  title: "Parcel {{ parcel }}",
  values: { parcel: "sample" },
  model: { instanceId: " provider ", model: " model " },
  runtimeMode: "approval-required",
};
const schema = parse(
  await readFile(
    new URL("../../../../docs/specifications/agent-threads.schema.yml", import.meta.url),
    "utf8",
  ),
) as object;
const ajv = new Ajv2020({ strict: false }).addSchema(schema);
const check = (name: string) =>
  ajv.compile({ $ref: `https://manifold.wyrd.company/schemas/agent-threads#/$defs/${name}` });
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
});
async function setup(overrides: Partial<AgentThreadsOptions> = {}) {
  const directory = await mkdtemp(join(tmpdir(), "agent-threads-"));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  const token = join(directory, "token");
  await writeFile(token, "fixture-token");
  const server = await fakeServer();
  cleanup.push(() => server.close());
  const commands: Record<string, unknown>[] = [];
  const receipts = new Map<string, number>();
  server.hooks.dispatch = (raw) => {
    const command = raw as Record<string, unknown>;
    commands.push(command);
    expect(
      schemas.orchestrationCommands.ClientOrchestrationCommand.safeParse(command).success,
    ).toBe(true);
    const id = String(command["commandId"]);
    const receipt = receipts.get(id);
    if (receipt !== undefined) return { sequence: receipt };
    const sequence = receipts.size + 1;
    receipts.set(id, sequence);
    return { sequence };
  };
  const options: AgentThreadsOptions = {
    environments: {
      station: {
        url: server.url,
        credential: "writer",
        reconnect: { initialMs: 1, maxMs: 5, factor: 2, jitter: 0 },
        heartbeat: { intervalMs: 5000, missedPongLimit: 3 },
        openTimeoutMs: 10000,
      },
    },
    tokenFile: () => token,
    actorOf: () => ({
      manifold: { environment: "station", project: "binding", threads: ["conversation"] },
      commit,
    }),
    invocationOf: () => invocation,
    bindingArchived: () => false,
    sourceReady: async () => {},
    sourceWrite: (_environment, _threadId, signal, send) => send(signal),
    revisionAt: async () =>
      memoryRevision(commit, {
        "templates/prompt.njk": '{% include "templates/fragment.njk" %} {{ parcel }}',
        "templates/fragment.njk": "Process",
      }),
    ...overrides,
  };
  const module = openAgentThreads(options);
  cleanup.push(() => module.stop());
  async function run(name: string, input?: unknown) {
    const actor = createActor(module.implementations.actors[name]!, { input });
    actor.start();
    let result: unknown;
    try {
      result = await toPromise(actor);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "AgentThreadError"
      )
        expect(check("error")(error)).toBe(true);
      throw error;
    }
    expect(check(`${name}-output`)(result)).toBe(true);
    return result as Record<string, string>;
  }
  return { module, server, commands, receipts, run, options };
}
test("same invocation gives fixed ids and new entries give new ids", async () => {
  let entryId = invocation.entryId;
  const fixture = await setup({ invocationOf: () => ({ ...invocation, entryId }) });
  const first = await fixture.run("thread-create", input);
  const again = await fixture.run("thread-create", input);
  expect(first).toEqual(again);
  expect(fixture.commands[0]).toMatchObject({
    title: "Parcel sample",
    projectId: "project",
    modelSelection: { instanceId: "provider", model: "model" },
    runtimeMode: "approval-required",
    branch: null,
    worktreePath: null,
  });
  expect(fixture.commands[0]!["commandId"]).toBe("52182db5-58f9-8f5e-a2ab-9f58d36fb901");
  expect(first["threadId"]).toBe("63af93c1-64f4-8ffc-b219-5daaf7dffc24");
  const prepared = await fixture.run("turn-prepare");
  expect(prepared["messageId"]).toBe("f3ee3b77-46c9-8c92-ba06-e38474f3f7c6");
  entryId = "entry-two";
  expect(await fixture.run("thread-create", input)).not.toEqual(first);
});
test("thread-create defaults an absent runtimeMode to full-access", async () => {
  const fixture = await setup();
  const { runtimeMode: _mode, ...withoutMode } = input;
  await fixture.run("thread-create", withoutMode);
  expect(fixture.commands[0]).toMatchObject({ runtimeMode: "full-access" });
});
test("turn uses prepared message, revision includes, trimmed values, and current modes", async () => {
  const fixture = await setup();
  fixture.server.baseline(fixtureThread());
  const prepared = await fixture.run("turn-prepare");
  const result = await fixture.run("turn-start", {
    threadId: " conversation ",
    messageId: prepared["messageId"],
    prompt: "templates/prompt.njk",
    values: { parcel: "sample" },
  });
  expect(result).toEqual({ threadId: "conversation", messageId: prepared["messageId"] });
  expect(fixture.commands[0]).toMatchObject({
    type: "thread.turn.start",
    commandId: "50381d23-32ae-80c9-8486-eba0a544282e",
    runtimeMode: "full-access",
    interactionMode: "default",
    message: {
      messageId: prepared["messageId"],
      role: "user",
      text: "Process sample",
      attachments: [],
    },
  });
});
test.each([
  { model: { instanceId: "1invalid", model: "model" } },
  { model: { instanceId: "x".repeat(65), model: "model" } },
  { model: { instanceId: "provider", model: " " } },
  { branch: "" },
  { branch: " " },
  { worktreePath: "" },
  { worktreePath: " " },
  { runtimeMode: null },
  { unknown: true },
])("invalid input fails before dispatch: %j", async (patch) => {
  const fixture = await setup();
  await expect(fixture.run("thread-create", { ...input, ...patch })).rejects.toMatchObject({
    name: "AgentThreadError",
    kind: "input",
  });
  expect(fixture.commands).toHaveLength(0);
});
test.each([
  "Parcel {{ missing }}",
  "{% invalid %}",
  "{{ empty }}",
  '{% include "absent.njk" %}',
  '{% include "../escape.njk" %}',
])("template failure: %s", async (title) => {
  const fixture = await setup();
  await expect(
    fixture.run("thread-create", { ...input, title, values: { empty: "  " } }),
  ).rejects.toMatchObject({ name: "AgentThreadError", kind: "template" });
  expect(fixture.commands).toHaveLength(0);
});
test.each(["templates/absent.njk", "../escape.njk", "/absolute.njk"])(
  "missing or invalid prompt: %s",
  async (prompt) => {
    const fixture = await setup();
    await expect(
      fixture.run("turn-start", { threadId: "conversation", messageId: "message", prompt }),
    ).rejects.toMatchObject({
      name: "AgentThreadError",
      kind: prompt === "templates/absent.njk" ? "template" : "input",
    });
  },
);
test("archived and missing environment fail with typed errors", async () => {
  const archived = await setup({ bindingArchived: () => true });
  await expect(archived.run("thread-create", input)).rejects.toMatchObject({ kind: "archived" });
  const missing = await setup({ actorOf: () => undefined });
  await expect(missing.run("thread-create", input)).rejects.toMatchObject({ kind: "environment" });
  const unknown = await setup({
    actorOf: () => ({ manifold: { environment: "unknown" }, commit }),
  });
  await expect(unknown.run("thread-create", input)).rejects.toMatchObject({ kind: "environment" });
});
test("a turn cannot target a thread the actor does not follow", async () => {
  const fixture = await setup();
  await expect(
    fixture.run("turn-start", {
      threadId: "another",
      messageId: "message",
      prompt: "templates/prompt.njk",
    }),
  ).rejects.toMatchObject({ kind: "input" });
  expect(fixture.commands).toHaveLength(0);
});
test("readiness delays command; exiting invoke cancels wait", async () => {
  let release!: () => void;
  let waits = 0;
  const fixture = await setup({
    sourceReady: async (_environment, signal) => {
      waits++;
      await new Promise<void>((resolve, reject) => {
        release = resolve;
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    },
  });
  const actor = createActor(fixture.module.implementations.actors["thread-create"]!, { input });
  actor.start();
  await expect.poll(() => waits).toBe(1);
  expect(fixture.commands).toHaveLength(0);
  release();
  await toPromise(actor);
  expect(fixture.commands).toHaveLength(1);
  const stopped = createActor(fixture.module.implementations.actors["thread-create"]!, { input });
  stopped.start();
  await expect.poll(() => waits).toBe(2);
  stopped.stop();
  release();
  await new Promise((resolve) => setImmediate(resolve));
  expect(fixture.commands).toHaveLength(1);
});
test("follow-thread is an idempotent context assignment", async () => {
  const fixture = await setup();
  const machine = createMachine({
    context: { manifold: { environment: "station", threads: ["old"] } },
    on: { DONE: { actions: ["follow-thread", "follow-thread"] } },
  }).provide({
    actions: fixture.module.implementations.actions as NonNullable<
      Parameters<typeof machine.provide>[0]["actions"]
    >,
  });
  const actor = createActor(machine);
  actor.start();
  actor.send({ type: "DONE", output: { threadId: "conversation" } });
  expect(actor.getSnapshot().context).toEqual({
    manifold: { environment: "station", threads: ["old", "conversation"] },
  });
  actor.stop();
});

test("server rejection is typed and repeatable for the same ids", async () => {
  const fixture = await setup();
  fixture.server.hooks.dispatch = () => {
    throw new Error("Request refused");
  };
  for (let n = 0; n < 2; n++)
    await expect(fixture.run("thread-create", input)).rejects.toMatchObject({
      name: "AgentThreadError",
      kind: "rejected",
      serverMessage: expect.stringContaining("Request refused"),
    });
});
test("refused token fails unauthorized", async () => {
  const fixture = await setup();
  fixture.server.setToken("different-token");
  await expect(fixture.run("thread-create", input)).rejects.toMatchObject({
    name: "AgentThreadError",
    kind: "unauthorized",
  });
});
test("source stop fails waiting invoke with environment error", async () => {
  const fixture = await setup({
    sourceReady: async () => {
      throw { name: "AgentThreadError", kind: "environment", message: "Source stopped" };
    },
  });
  await expect(fixture.run("thread-create", input)).rejects.toMatchObject({ kind: "environment" });
  expect(fixture.commands).toHaveLength(0);
});
test("accepted model boundaries and option types match the client command schema", async () => {
  const fixture = await setup();
  for (const instanceId of ["x".repeat(64), " valid-instance_2 "])
    await fixture.run("thread-create", {
      ...input,
      model: { instanceId, model: " model ", options: { reasoning: " high ", enabled: true } },
      branch: " feature ",
      worktreePath: " /tmp/checkout ",
    });
  for (const command of fixture.commands)
    expect(command).toMatchObject({
      modelSelection: {
        options: [
          { id: "reasoning", value: "high" },
          { id: "enabled", value: true },
        ],
      },
      branch: "feature",
      worktreePath: "/tmp/checkout",
    });
});
test("client local mode rejection maps to input", async () => {
  const fixture = await setup();
  const thread = fixtureThread();
  fixture.server.baseline({ ...thread, runtimeMode: "future-mode" });
  await expect(
    fixture.run("turn-start", {
      threadId: "conversation",
      messageId: "message",
      prompt: "templates/prompt.njk",
      values: { parcel: "sample" },
    }),
  ).rejects.toMatchObject({ kind: "input" });
  expect(fixture.commands).toHaveLength(0);
});
test("module stop aborts an invoke waiting for readiness", async () => {
  let waiting = false;
  const fixture = await setup({
    sourceReady: async (_environment, signal) => {
      waiting = true;
      await new Promise<void>((_resolve, reject) =>
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true }),
      );
    },
  });
  const actor = createActor(fixture.module.implementations.actors["thread-create"]!, { input });
  actor.start();
  const rejected = expect(toPromise(actor)).rejects.toBeDefined();
  await expect.poll(() => waiting).toBe(true);
  await fixture.module.stop();
  await rejected;
  expect(fixture.commands).toHaveLength(0);
});

test("opened registry composes the same names offered by blueprint lint", async () => {
  const fixture = await setup();
  const { serviceImplementations } = await import("../implementations.ts");
  const { manifoldImplementationNames } = await import("@wyrd-company/manifold-shared");
  const composed = serviceImplementations({ agentThreads: fixture.module.implementations });
  for (const kind of ["actors", "actions", "guards", "delays"] as const)
    for (const name of Object.keys(composed[kind]))
      expect(manifoldImplementationNames[kind].has(name)).toBe(true);
});
test("specification example lints and binds all agent thread implementations", async () => {
  const fixture = await setup();
  const { lintBlueprint, manifoldImplementationNames } =
    await import("@wyrd-company/manifold-shared");
  const { stringify } = await import("yaml");
  const spec = parse(
    await readFile(
      new URL("../../../../docs/specifications/agent-threads.yml", import.meta.url),
      "utf8",
    ),
  ) as { description: string };
  const code = spec.description.match(/```yaml\n([\s\S]*?)\n```/)![1]!;
  const states = parse(code) as Record<string, unknown>;
  const doc = {
    machine: {
      id: "parcel",
      initial: "working",
      context: {
        workspace: "project",
        parcel: "sample",
        thread: "",
        turn: "",
      },
      states: { ...states, reviewing: { type: "final" } },
    },
    schemas: {
      input: true,
      output: true,
      context: { type: "object" },
      events: { "t3.turn.settled": { type: "object" } },
      actors: {
        "thread-create": { input: true, output: true },
        "turn-prepare": { input: true, output: true },
        "turn-start": { input: true, output: true },
      },
    },
  };
  const text = stringify(doc);
  const lint = await lintBlueprint("blueprints/parcel.yml", text, manifoldImplementationNames);
  expect(lint.ok, JSON.stringify(lint)).toBe(true);
  const { createBlueprintLoader } = await import("../blueprint-loader/index.ts");
  const loader = createBlueprintLoader({
    implementations: fixture.module.implementations,
    revisionAt: async () => memoryRevision(commit, { "blueprints/parcel.yml": text }),
    onExpressionError: (error) => {
      throw error;
    },
  });
  expect((await loader.version({ commit, path: "blueprints/parcel.yml" })).status).toBe("loaded");
});

test("restored actor renders only its recorded revision across includes and imports", async () => {
  const commits: string[] = [];
  const fixture = await setup({
    revisionAt: async (requested) => {
      commits.push(requested);
      return memoryRevision(
        requested,
        requested === commit
          ? {
              "templates/prompt.njk":
                '{% extends "templates/base.njk" %}{% block body %}{% import "templates/macros.njk" as m %}{{ m.describe(parcel) }}{% endblock %}',
              "templates/base.njk": "{% block body %}{% endblock %}",
              "templates/macros.njk":
                "{% macro describe(value) %}Original {{ value }}{% endmacro %}",
            }
          : { "templates/prompt.njk": "Changed" },
      );
    },
  });
  await fixture.run("turn-start", {
    threadId: "conversation",
    messageId: "message",
    prompt: "templates/prompt.njk",
    values: { parcel: "sample" },
    runtimeMode: "approval-required",
    interactionMode: "default",
  });
  expect(commits).toEqual([commit]);
  expect(fixture.commands[0]).toMatchObject({ message: { text: "Original sample" } });
});
test("same actor entry with two invoke ids cannot share a command id", async () => {
  let invokeId = "first";
  const fixture = await setup({ invocationOf: () => ({ ...invocation, invokeId }) });
  await fixture.run("thread-create", input);
  invokeId = "second";
  await fixture.run("thread-create", input);
  expect(fixture.commands[0]!["commandId"]).not.toBe(fixture.commands[1]!["commandId"]);
});

test.each(["missing", "failed"])("revision %s fails as a template error", async (reason) => {
  const fixture = await setup({
    revisionAt: async () => {
      if (reason === "failed") throw new Error("Revision unavailable");
      return undefined;
    },
  });
  await expect(fixture.run("thread-create", input)).rejects.toMatchObject({ kind: "template" });
  expect(fixture.commands).toHaveLength(0);
});

test("token without required scope fails unauthorized without dispatch", async () => {
  const fixture = await setup();
  fixture.server.hooks.ticketStatus = 403;
  await expect(fixture.run("thread-create", input)).rejects.toMatchObject({ kind: "unauthorized" });
  expect(fixture.commands).toHaveLength(0);
});

test("missing token file fails unauthorized rather than retrying connection setup", async () => {
  const fixture = await setup();
  await rm(fixture.options.tokenFile("writer"));
  await expect(fixture.run("thread-create", input)).rejects.toMatchObject({
    name: "AgentThreadError",
    kind: "unauthorized",
  });
});
