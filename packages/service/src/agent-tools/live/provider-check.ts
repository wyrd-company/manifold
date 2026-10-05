// ---
// relationships:
//   verifies: [agent-tools, host-cli-mcp]
//   references: t3code-tool-call-ids-undocumented
// ---
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createServer as httpServer } from "node:http";
import { createServer as netServer } from "node:net";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { T3Client, schemas, threadId } from "@wyrd-company/t3code-client";

const execute = promisify(execFile);
const require = createRequire(import.meta.url);
const release = createRequire(require.resolve("t3/package.json"));
const executable = join(
  dirname(release.resolve(`@t3code/t3-${process.platform}-${process.arch}/package.json`)),
  process.platform === "win32" ? "t3.exe" : "t3",
);
const cache = resolve("node_modules/.cache");
await mkdir(cache, { recursive: true });
const directory = await mkdtemp(join(cache, "agent-tools-live-"));
const home = join(directory, "home");
const base = join(directory, "data");
const workspace = join(directory, "parcels");
const plugin = join(directory, "manifold-host");
const originalHome = homedir();
const environment = {
  ...process.env,
  HOME: home,
  XDG_CONFIG_HOME: join(home, ".config"),
  XDG_DATA_HOME: join(home, ".local/share"),
  CLAUDE_CONFIG_DIR: join(home, ".claude"),
  CODEX_HOME: join(home, ".codex"),
};
let child: ReturnType<typeof spawn> | undefined;
let client: T3Client | undefined;
let activeThread = "";
let received: { arguments: Record<string, unknown>; meta: Record<string, unknown> } | undefined;
const records: {
  provider: string;
  loaded: boolean;
  metaKeys: string[];
  callIdMatchesActivity: boolean | null;
  identifiedBy: string;
  limitation?: string;
}[] = [];
const endpoint = httpServer(async (request, response) => {
  let body = "";
  for await (const chunk of request) body += String(chunk);
  received = JSON.parse(body);
  response.setHeader("Content-Type", "application/json");
  response.end(
    JSON.stringify({
      status: "accepted",
      replay: false,
      eventId: "live-handoff",
      threadId: activeThread,
      turnId: "live-turn",
      message: "Handoff accepted. End your turn now.",
    }),
  );
});

async function freePort() {
  const reservation = netServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const address = reservation.address();
  assert(address && typeof address !== "string");
  await new Promise<void>((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}
async function linkAuth(source: string, target: string) {
  // Do not read credentials. Each harness accesses its own existing auth through this link.
  await mkdir(dirname(target), { recursive: true });
  await symlink(source, target);
}
try {
  for (const path of [
    home,
    workspace,
    join(base, "userdata"),
    join(home, ".claude"),
    join(home, ".codex"),
    join(home, ".cursor"),
    join(home, ".config/opencode"),
  ])
    await mkdir(path, { recursive: true });
  await linkAuth(
    join(originalHome, ".claude/.credentials.json"),
    join(home, ".claude/.credentials.json"),
  );
  await linkAuth(join(originalHome, ".codex/auth.json"), join(home, ".codex/auth.json"));
  await linkAuth(
    join(originalHome, ".config/cursor/auth.json"),
    join(home, ".config/cursor/auth.json"),
  );
  await linkAuth(
    join(originalHome, ".config/opencode/auth.json"),
    join(home, ".config/opencode/auth.json"),
  );
  await linkAuth(
    join(process.env["XDG_DATA_HOME"] ?? join(originalHome, ".local/share"), "opencode/auth.json"),
    join(home, ".local/share/opencode/auth.json"),
  );
  await execute(
    resolve("../host-cli/node_modules/.bin/bun"),
    ["build", "src/cli.ts", "--compile", "--bytecode", "--outfile", plugin],
    {
      cwd: resolve("../host-cli"),
    },
  );
  endpoint.listen(0, "127.0.0.1");
  await once(endpoint, "listening");
  const address = endpoint.address();
  assert(address && typeof address !== "string");
  const args = [
    "mcp",
    "--service",
    `http://127.0.0.1:${address.port}`,
    "--environment",
    "workstation",
  ];
  const registration = { command: plugin, args };
  await writeFile(
    join(home, ".claude/.claude.json"),
    JSON.stringify({ mcpServers: { manifold: { type: "stdio", ...registration } } }),
  );
  await writeFile(
    join(home, ".codex/config.toml"),
    `[mcp_servers.manifold]\ncommand = ${JSON.stringify(plugin)}\nargs = ${JSON.stringify(args)}\n`,
  );
  await writeFile(
    join(home, ".cursor/mcp.json"),
    JSON.stringify({ mcpServers: { manifold: registration } }),
  );
  await writeFile(
    join(home, ".config/opencode/opencode.json"),
    JSON.stringify({
      mcp: { manifold: { type: "local", command: [plugin, ...args], enabled: true } },
    }),
  );
  await writeFile(
    join(base, "userdata/settings.json"),
    JSON.stringify({
      enableProviderUpdateChecks: false,
      providers: {
        claudeAgent: { enabled: true, homePath: join(home, ".claude") },
        codex: { enabled: true, homePath: join(home, ".codex") },
        cursor: { enabled: true },
        opencode: { enabled: true },
        grok: { enabled: false },
      },
    }),
  );
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
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
  const startDeadline = Date.now() + 20000;
  while (true) {
    if (child.exitCode !== null || child.signalCode !== null)
      throw Error("Fixture server exited during startup");
    try {
      if (
        (await fetch(`${baseUrl}/.well-known/t3/environment`, { signal: AbortSignal.timeout(500) }))
          .ok
      )
        break;
    } catch {
      /* Fixture is binding. */
    }
    if (Date.now() > startDeadline) throw Error("Fixture server did not start");
    await delay(100);
  }
  const { stdout } = await execute(
    executable,
    [
      "auth",
      "session",
      "issue",
      "--base-dir",
      base,
      "--token-only",
      "--label",
      "Agent tools fixture",
    ],
    { cwd: workspace, env: environment },
  );
  client = T3Client.create({ baseUrl, accessToken: stdout.trim() });
  await client.connect();
  const project = await client.projects.create({ title: "Parcels", workspaceRoot: workspace });
  let providers = await client.server.providers();
  for (
    let attempt = 0;
    attempt < 40 &&
    providers.some(
      (p) =>
        ["claudeAgent", "codex", "cursor", "opencode"].includes(p.driver) && p.models.length === 0,
    );
    attempt++
  ) {
    await delay(500);
    providers = await client.server.providers();
  }
  for (const driver of ["claude", "codex", "cursor", "opencode"]) {
    const provider = providers.find(
      (p) => p.driver === (driver === "claude" ? "claudeAgent" : driver),
    );
    console.log(
      JSON.stringify({
        provider: driver,
        installed: provider?.installed,
        enabled: provider?.enabled,
        auth: provider?.auth.status,
        modelCount: provider?.models.length,
      }),
    );
    if (!provider?.enabled || !provider.installed || provider.models.length === 0) {
      records.push({
        provider: driver,
        loaded: false,
        metaKeys: [],
        callIdMatchesActivity: null,
        identifiedBy: "not measured",
        limitation: "Fixture provider unavailable or has no models",
      });
      continue;
    }
    activeThread = `parcel-${driver}`;
    received = undefined;
    const model = provider.models.find((m) => m.isDefault) ?? provider.models[0]!;
    const modelSelection = { instanceId: provider.instanceId, model: model.slug };
    await client.threads.dispatch(
      schemas.orchestrationCommands.ClientOrchestrationCommand.parse({
        type: "thread.create",
        commandId: `create-${driver}`,
        threadId: activeThread,
        projectId: project.id,
        title: "Sort a parcel",
        modelSelection,
        runtimeMode: "full-access",
        interactionMode: "default",
        branch: null,
        worktreePath: null,
        createdAt: new Date().toISOString(),
      }),
    );
    await client.threads.dispatch(
      schemas.orchestrationCommands.ClientOrchestrationCommand.parse({
        type: "thread.turn.start",
        commandId: `start-${driver}`,
        threadId: activeThread,
        message: {
          messageId: `parcel-message-${driver}`,
          role: "user",
          text: `This is a tool availability measurement. Call the manifold handoff tool exactly once, immediately, with handoff {"outcome":"done","summary":"Sorted a parcel."} and thread "${activeThread}". Do no other work. Then end your turn. If that tool is unavailable, say so and end your turn.`,
          attachments: [],
        },
        modelSelection,
        runtimeMode: "full-access",
        interactionMode: "default",
        createdAt: new Date().toISOString(),
      }),
    );
    const deadline = Date.now() + 90000;
    let detail = await client.threads.detail(threadId(activeThread));
    while (Date.now() < deadline) {
      await delay(500);
      detail = await client.threads.detail(threadId(activeThread));
      if (
        received ||
        detail.thread.session?.status === "error" ||
        detail.thread.latestTurn?.state === "completed" ||
        detail.thread.latestTurn?.state === "failed"
      )
        break;
    }
    // An activity can follow the HTTP request, so read the recording after receiving the call.
    if (received) {
      await delay(1000);
      detail = await client.threads.detail(threadId(activeThread));
    }
    const call = received as
      | { arguments: Record<string, unknown>; meta: Record<string, unknown> }
      | undefined;
    const callId = call?.meta["claudecode/toolUseId"] ?? call?.meta["callId"];
    const matched =
      typeof callId === "string" &&
      detail.thread.activities.some(
        (activity) =>
          typeof activity.payload === "object" &&
          activity.payload !== null &&
          "toolCallId" in activity.payload &&
          activity.payload.toolCallId === callId,
      );
    const identified = matched
      ? "call id"
      : call?.arguments["thread"] === activeThread
        ? "thread argument"
        : "not identified";
    records.push({
      provider: driver,
      loaded: !!call,
      metaKeys: Object.keys(call?.meta ?? {}).sort(),
      callIdMatchesActivity: typeof callId === "string" ? matched : null,
      identifiedBy: identified,
      ...(!call
        ? {
            limitation: detail.thread.session?.lastError
              ? "Provider session failed before a tool call; inspect the harness authentication/configuration"
              : "No tool call observed before the measurement bound",
          }
        : {}),
    });
    console.log(JSON.stringify(records.at(-1)));
    await client.threads.stopSession(threadId(activeThread));
  }
  records.push({
    provider: "grok",
    loaded: false,
    metaKeys: [],
    callIdMatchesActivity: null,
    identifiedBy: "not measured",
    limitation: "Grok is disabled",
  });
  console.log(JSON.stringify({ t3Release: "0.0.45", measurements: records }));
  if (
    records
      .filter((r) => r.provider !== "grok")
      .some((r) => !r.loaded || r.identifiedBy === "not identified")
  )
    process.exitCode = 1;
} finally {
  await client?.close();
  if (child?.pid && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    await exited;
  }
  endpoint.closeAllConnections();
  endpoint.close();
  await rm(directory, { recursive: true, force: true });
}
