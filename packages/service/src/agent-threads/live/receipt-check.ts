// ---
// relationships:
//   verifies: agent-threads
//   references: t3code-command-receipts-undocumented
// ---
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { T3Client, schemas, threadId, projectId } from "@wyrd-company/t3code-client";

import { memoryRevision } from "@wyrd-company/manifold-shared";
import { createActor, toPromise } from "xstate";
import { openAgentThreads } from "../index.ts";
import { openHistory } from "../../history/index.ts";
import { openStore } from "../../store/index.ts";

// Resolve the executable itself so SIGKILL targets the server, not its npm launcher.
const require = createRequire(import.meta.url);
const release = createRequire(require.resolve("t3/package.json"));
const executable = join(
  dirname(release.resolve(`@t3code/t3-${process.platform}-${process.arch}/package.json`)),
  process.platform === "win32" ? "t3.exe" : "t3",
);
const directory = await mkdtemp(join(process.cwd(), ".agent-thread-live-"));
const base = join(directory, "data");
const workspace = join(directory, "recipes");
// The fixture never inherits provider credentials or the operator's home directory.
const environment = {
  PATH: process.env["PATH"] ?? "",
  HOME: directory,
  XDG_CONFIG_HOME: directory,
};
let port = 0;
let baseUrl = "";
let child: ReturnType<typeof spawn> | undefined;
let client: T3Client | undefined;
async function launch() {
  let spawnError: Error | undefined;
  child = spawn(
    executable,
    [
      "start",
      "--mode",
      "desktop",
      "--no-browser",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--base-dir",
      base,
    ],
    { cwd: workspace, env: environment, stdio: "ignore" },
  );
  child.on("error", (error) => {
    spawnError = error;
  });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error(`Fixture server exited (${child.exitCode}, ${child.signalCode})`);
    try {
      const response = await fetch(`${baseUrl}/.well-known/t3/environment`, {
        signal: AbortSignal.timeout(500),
      });
      if (response.ok) return;
    } catch {
      /* The fixture has not bound its socket yet. */
    }
    await delay(50);
  }
  throw new Error("Fixture server did not start");
}
async function kill() {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  assert(child.kill("SIGKILL"));
  assert.deepEqual(await exited, [null, "SIGKILL"]);
  child = undefined;
}
try {
  await mkdir(workspace);
  const reservation = createServer();
  await new Promise<void>((resolve, reject) => {
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", resolve);
  });
  try {
    const address = reservation.address();
    assert(address && typeof address !== "string");
    port = address.port;
    baseUrl = `http://127.0.0.1:${port}`;
  } finally {
    await new Promise<void>((resolve, reject) =>
      reservation.close((error) => (error ? reject(error) : resolve())),
    );
  }
  await launch();
  const { stdout } = await promisify(execFile)(
    executable,
    ["auth", "session", "issue", "--base-dir", base, "--token-only", "--label", "Receipt fixture"],
    { cwd: workspace, env: environment },
  );
  const accessToken = stdout.trim();
  assert(accessToken.length > 0);
  client = T3Client.create({ baseUrl, accessToken });
  await client.connect();
  const descriptor = await client.server.environment();
  assert.equal(descriptor.platform.os, process.platform === "win32" ? "windows" : process.platform);
  const missingRoot = join(directory, "missing", "parents", "recipes");
  const projectCreate = schemas.orchestrationCommands.ClientOrchestrationCommand.parse({
    type: "project.create",
    commandId: "create-project",
    projectId: "recipe-project",
    title: "Recipes",
    workspaceRoot: missingRoot,
    createWorkspaceRootIfMissing: true,
    createdAt: new Date().toISOString(),
  });
  await assert.rejects(
    client.threads.dispatch(
      schemas.orchestrationCommands.ClientOrchestrationCommand.parse({
        ...projectCreate,
        projectId: "missing-project",
        commandId: "missing-root",
        createWorkspaceRootIfMissing: false,
      }),
    ),
    /Workspace root does not exist/,
  );
  await assert.rejects(stat(missingRoot), { code: "ENOENT" });
  const projectEvents: string[] = [];
  const observation = new AbortController();
  const shell = (async () => {
    for await (const item of client!.shell.watch({
      afterSequence: 0,
      signal: observation.signal,
    })) {
      if (item.kind === "project-upserted") projectEvents.push(item.project.id);
    }
  })();
  void shell.catch(() => {});
  const projectCreated = await client.threads.dispatch(projectCreate);
  assert.deepEqual(
    await client.threads.dispatch(
      schemas.orchestrationCommands.ClientOrchestrationCommand.parse({
        ...projectCreate,
        title: "Different title",
      }),
    ),
    projectCreated,
  );
  assert((await stat(missingRoot)).isDirectory());
  const fileRoot = join(directory, "a-file");
  await writeFile(fileRoot, "fixture");
  await assert.rejects(
    client.threads.dispatch(
      schemas.orchestrationCommands.ClientOrchestrationCommand.parse({
        ...projectCreate,
        commandId: "file-root",
        projectId: "file-project",
        workspaceRoot: fileRoot,
      }),
    ),
    /Workspace root is not a directory/,
  );
  await assert.rejects(
    client.threads.dispatch(
      schemas.orchestrationCommands.ClientOrchestrationCommand.parse({
        ...projectCreate,
        commandId: "duplicate-root",
        projectId: "duplicate-project",
      }),
    ),
    /already|associated/i,
  );
  await assert.rejects(
    client.threads.dispatch(
      schemas.orchestrationCommands.ClientOrchestrationCommand.parse({
        ...projectCreate,
        projectId: "different-project",
      }),
    ),
    /replay|aggregate|project/i,
  );
  const project = { id: projectId("recipe-project") };
  const createdAt = new Date().toISOString();
  const create = schemas.orchestrationCommands.ClientOrchestrationCommand.parse({
    type: "thread.create",
    commandId: "create-recipe",
    threadId: "recipe-thread",
    projectId: project.id,
    title: "Bake bread",
    modelSelection: { instanceId: "unconfigured", model: "unconfigured" },
    runtimeMode: "approval-required",
    interactionMode: "default",
    branch: null,
    worktreePath: null,
    createdAt,
  });
  const turn = schemas.orchestrationCommands.ClientOrchestrationCommand.parse({
    type: "thread.turn.start",
    commandId: "prepare-recipe",
    threadId: "recipe-thread",
    message: {
      messageId: "recipe-message",
      role: "user",
      text: "Describe a bread recipe",
      attachments: [],
    },
    runtimeMode: "approval-required",
    interactionMode: "default",
    createdAt,
  });
  const created = await client.threads.dispatch(create);
  assert.deepEqual(
    await client.threads.dispatch(
      schemas.orchestrationCommands.ClientOrchestrationCommand.parse({
        ...create,
        title: "A different title",
        createdAt: new Date().toISOString(),
      }),
    ),
    created,
  );
  const started = await client.threads.dispatch(turn);
  assert.deepEqual(
    await client.threads.dispatch(
      schemas.orchestrationCommands.ClientOrchestrationCommand.parse({
        ...turn,
        message: {
          messageId: "recipe-message",
          role: "user",
          text: "A different recipe",
          attachments: [],
        },
        createdAt: new Date().toISOString(),
      }),
    ),
    started,
  );
  let observedMessageCreatedAt: string | undefined;
  async function verify() {
    assert(client);
    const threads = await client.threads.list({ projectId: project.id });
    assert.equal(threads.length, 1);
    const { thread } = await client.threads.detail(threadId("recipe-thread"));
    const users = thread.messages.filter((message) => message.role === "user");
    assert.equal(users.length, 1);
    assert.equal(users[0]!.id, "recipe-message");
    assert.equal(thread.title, "Bake bread");
    assert.equal(users[0]!.text, "Describe a bread recipe");
    observedMessageCreatedAt ??= users[0]!.createdAt;
    assert.equal(users[0]!.createdAt, observedMessageCreatedAt);
    assert.equal(thread.latestTurn, null, "An unconfigured provider must not run an agent turn");
  }
  await verify();
  const eventDeadline = Date.now() + 5000;
  while (!projectEvents.includes(project.id) && Date.now() < eventDeadline) await delay(20);
  assert(projectEvents.includes(project.id), "The shell publishes project-upserted");
  observation.abort();
  await shell.catch(() => {});
  await client.close();
  client = undefined;
  await kill();
  await launch();
  client = T3Client.create({ baseUrl, accessToken });
  await client.connect();
  assert.deepEqual(await client.threads.dispatch(projectCreate), projectCreated);
  const projects = (await client.shell.readModel()).projects;
  assert.equal(projects.length, 1);
  assert.equal(projects[0]!.title, "Recipes");
  assert.equal(projects[0]!.workspaceRoot, missingRoot);
  assert.equal(projectEvents.filter((id) => id === project.id).length, 1);
  assert.deepEqual(
    await client.threads.dispatch(
      schemas.orchestrationCommands.ClientOrchestrationCommand.parse({
        ...create,
        title: "A different title",
        createdAt: new Date().toISOString(),
      }),
    ),
    created,
  );
  assert.deepEqual(
    await client.threads.dispatch(
      schemas.orchestrationCommands.ClientOrchestrationCommand.parse({
        ...turn,
        message: {
          messageId: "recipe-message",
          role: "user",
          text: "A different recipe",
          attachments: [],
        },
        createdAt: new Date().toISOString(),
      }),
    ),
    started,
  );
  await verify();
  const store = openStore({ path: join(directory, "history.sqlite") });
  const history = openHistory({
    store,
    log: (entry) => {
      throw new Error(entry.message);
    },
  });
  const invocation = { actorId: "recipe", invokeId: "create", entryId: "one" };
  store.saveSnapshot({
    actorId: invocation.actorId,
    machine: "recipe",
    snapshot: { status: "active", value: "creating" },
  });
  const module = openAgentThreads({
    environments: {
      fixture: {
        url: baseUrl,
        credential: "writer",
        reconnect: { initialMs: 1, factor: 2, maxMs: 5, jitter: 0 },
        heartbeat: { intervalMs: 5000, missedPongLimit: 3 },
        openTimeoutMs: 10000,
      },
    },
    tokenFile: () => join(directory, "token"),
    actorOf: () => ({
      manifold: { environment: "fixture", portfolioItem: "recipes" },
      commit: "a".repeat(40),
    }),
    invocationOf: () => invocation,
    bindingArchived: () => false,
    sourceReady: async () => {},
    sourcePlatform: async () => descriptor.platform.os,
    sourceWrite: (_environment, _thread, signal, send) => send(signal),
    revisionAt: async () => memoryRevision("a".repeat(40), {}),
    recordProject: () => {},
    sending: (command) => {
      history.commandSending(command);
      assert.equal(history.read(invocation.actorId)!.commands.length, 1);
    },
    probe: history.commandAccepted,
  });
  try {
    await writeFile(join(directory, "token"), accessToken);
    const create = () => {
      const actor = createActor(module.implementations.actors["t3code-project-create"]!, {
        input: {
          title: "Recipe collection",
          workspaceRoot: join(directory, "collection"),
          createWorkspaceRoot: true,
        },
      });
      actor.start();
      return toPromise(actor);
    };
    const result = (await create()) as { projectId: string };
    const commands = history.read(invocation.actorId)!.commands;
    assert.equal(commands.length, 1);
    assert.equal(commands[0]!.kind, "project-create");
    assert.equal(commands[0]!.projectId, result.projectId);
    assert.equal("threadId" in commands[0]!, false);
    assert(commands[0]!.acceptedAt);
    // The repeated invoke reads the original receipt and keeps one history row.
    assert.deepEqual(await create(), result);
    assert.deepEqual(history.read(invocation.actorId)!.commands, commands);
    assert.equal(
      (await client.shell.readModel()).projects.filter((p) => p.id === result.projectId).length,
      1,
    );
  } finally {
    await module.stop();
    store.close();
  }
  console.log(
    JSON.stringify({
      serverVersion: descriptor.serverVersion,
      historyProjectCreate: true,
      historyCommands: 1,
      projectCreateSequence: projectCreated.sequence,
      projects: 1,
      projectUpserted: true,
      missingRootRejected: true,
      optedInRootCreated: true,
      threadCreateSequence: created.sequence,
      turnStartSequence: started.sequence,
      repeatedBeforeAndAfterSigkill: true,
      threads: 1,
      userMessages: 1,
      agentTurns: 0,
      submittedCommandCreatedAt: createdAt,
      observedMessageCreatedAt,
    }),
  );
} catch (error) {
  console.error(error);
  throw error;
} finally {
  try {
    await client?.close();
  } finally {
    try {
      await kill();
    } finally {
      await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  }
}
