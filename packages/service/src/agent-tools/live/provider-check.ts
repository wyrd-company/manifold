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
import { createInterface } from "node:readline";
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
let noticed = false;
let readMail = false;
let noticeRequests = 0;
let received: { arguments: Record<string, unknown>; meta: Record<string, unknown> } | undefined;
const records: {
  provider: string;
  loaded: boolean;
  noticeReached?: boolean;
  getMessagesCalled?: boolean;
  userMessages?: number;
  metaKeys: string[];
  callIdMatchesActivity: boolean | null;
  identifiedBy: string;
  limitation?: string;
}[] = [];
const endpoint = httpServer(async (request, response) => {
  let body = "";
  for await (const chunk of request) body += String(chunk);
  const requestBody = JSON.parse(body);
  response.setHeader("Content-Type", "application/json");
  if (request.url === "/api/agent-tools/notices") {
    noticeRequests++;
    const notice =
      !noticed && (requestBody.threadId === activeThread || requestBody.callId)
        ? "Manifold: 1 new message for this thread. Read it with the manifold get-messages tool when your current step is done. Do not stop or end your turn for it."
        : null;
    if (notice) noticed = true;
    response.end(JSON.stringify({ notice }));
  } else if (requestBody.tool === "get-messages") {
    readMail = true;
    response.end(
      JSON.stringify({
        status: "read",
        threadId: activeThread,
        turnId: "live-turn",
        messages: [
          {
            messageId: "00000000-0000-4000-8000-000000000001",
            from: { actorId: "depot", issue: null, task: null },
            text: "The depot schedule changed.",
            sentAt: new Date().toISOString(),
            deliveredAt: new Date().toISOString(),
          },
        ],
        message: "You have 1 message. The depot schedule changed.",
      }),
    );
  } else {
    received = requestBody;
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
  }
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
async function trustCodexHook() {
  const server = spawn("codex", ["app-server"], {
    cwd: workspace,
    env: environment,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const responses = new Map<number, Record<string, unknown>>();
  createInterface({ input: server.stdout }).on("line", (line) => {
    try {
      const value = JSON.parse(line);
      if (typeof value.id === "number") responses.set(value.id, value);
    } catch {}
  });
  async function rpc(id: number, method: string, params: unknown) {
    server.stdin.write(JSON.stringify({ id, method, params }) + "\n");
    const until = Date.now() + 10000;
    while (!responses.has(id) && Date.now() < until) await delay(50);
    const response = responses.get(id);
    if (!response || response["error"])
      throw Error(`Codex ${method} failed: ${JSON.stringify(response)}`);
    return response["result"];
  }
  try {
    await rpc(1, "initialize", {
      clientInfo: { name: "mail-notice-fixture", version: "1" },
      capabilities: { experimentalApi: true },
    });
    const result = await rpc(2, "hooks/list", { cwds: [workspace] });
    console.log(JSON.stringify({ codexHooks: result }));
    const hooks: { key: string; currentHash: string }[] = [];
    function visit(value: unknown) {
      if (!value || typeof value !== "object") return;
      if (
        "key" in value &&
        "currentHash" in value &&
        typeof value.key === "string" &&
        typeof value.currentHash === "string"
      )
        hooks.push({ key: value.key, currentHash: value.currentHash });
      for (const child of Object.values(value)) visit(child);
    }
    visit(result);
    assert(hooks.length > 0, "No Codex hook found to trust");
    const { appendFile } = await import("node:fs/promises");
    await appendFile(
      join(home, ".codex/config.toml"),
      hooks
        .map(
          (hook) =>
            `\n[hooks.state.${JSON.stringify(hook.key)}]\ntrusted_hash = ${JSON.stringify(hook.currentHash)}\n`,
        )
        .join(""),
    );
  } finally {
    const exited = once(server, "exit");
    server.kill("SIGTERM");
    await exited;
  }
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
    ["build", "src/cli.ts", "src/hook/worker.ts", "--compile", "--bytecode", "--outfile", plugin],
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
  const hook = (provider: string) =>
    `${plugin} hook post-tool-use --service http://127.0.0.1:${address.port} --environment workstation --provider ${provider} --t3-home ${base}`;
  await writeFile(
    join(home, ".claude/settings.json"),
    JSON.stringify({
      hooks: {
        PostToolUse: [{ matcher: "*", hooks: [{ type: "command", command: hook("claude") }] }],
      },
    }),
  );
  await writeFile(
    join(home, ".cursor/hooks.json"),
    JSON.stringify({ version: 1, hooks: { postToolUse: [{ command: hook("cursor") }] } }),
  );
  await mkdir(join(home, ".config/opencode/plugin"), { recursive: true });
  await writeFile(
    join(home, ".config/opencode/plugin/manifold.js"),
    `export const Manifold = async () => ({"tool.execute.after":async(input,output)=>{try {const response=await fetch("http://127.0.0.1:${address.port}/api/agent-tools/notices",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({environment:"workstation",callId:input.callID}),signal:AbortSignal.timeout(2000)});const body=response.ok ? await response.json():undefined;if(typeof body?.notice==="string") output.output=String(output.output??"")+"\\n\\n"+body.notice;}catch{}}});`,
  );
  await writeFile(
    join(home, ".claude/.claude.json"),
    JSON.stringify({ mcpServers: { manifold: { type: "stdio", ...registration } } }),
  );
  await writeFile(
    join(home, ".codex/config.toml"),
    `[mcp_servers.manifold]\ncommand = ${JSON.stringify(plugin)}\nargs = ${JSON.stringify(args)}\n[[hooks.PostToolUse]]\nmatcher = "*"\n[[hooks.PostToolUse.hooks]]\ntype = "command"\ncommand = ${JSON.stringify(hook("codex"))}\n`,
  );
  await trustCodexHook();
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
    noticed = false;
    readMail = false;
    noticeRequests = 0;
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
          text: `This is a tool and mail notice measurement. First run one shell command that prints ready. Then use the manifold get-messages tool with thread "${activeThread}" to read any messages. In your final reply state the message text and mail-notice-seen if you saw a Manifold new-message notice in the shell tool result, or mail-notice-absent if you did not. Then call manifold handoff once with handoff {"outcome":"done","summary":"Sorted a parcel."} and thread "${activeThread}" and end your turn. Do no other work.`,
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
      getMessagesCalled: readMail,
      noticeReached:
        noticed &&
        detail.thread.messages.some(
          (message) => message.role === "assistant" && message.text.includes("mail-notice-seen"),
        ),
      userMessages: detail.thread.messages.filter((message) => message.role === "user").length,
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
    console.log(JSON.stringify({ ...records.at(-1), noticeRequests }));
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
      .some(
        (r) =>
          !r.loaded ||
          !r.getMessagesCalled ||
          !r.noticeReached ||
          r.userMessages !== 1 ||
          r.identifiedBy === "not identified",
      )
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
