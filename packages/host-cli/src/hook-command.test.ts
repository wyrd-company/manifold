// ---
// relationships:
//   verifies: [host-cli-hook, agent-tools]
// ---
import { mkdtempSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { parse } from "yaml";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
let directory: string;
let binary: string;
beforeAll(() => {
  mkdirSync(resolve("node_modules/.cache"), { recursive: true });
  directory = mkdtempSync(resolve("node_modules/.cache/hook-build-"));
  binary = join(directory, "manifold-host");
  const build = spawnSync(
    "bun",
    ["build", "src/cli.ts", "src/hook/worker.ts", "--compile", "--bytecode", "--outfile", binary],
    { encoding: "utf8" },
  );
  expect(build.status, build.stderr).toBe(0);
  mkdirSync(join(directory, "userdata"));
  const db = new DatabaseSync(join(directory, "userdata/state.sqlite"));
  db.exec(
    "CREATE TABLE provider_session_runtime(thread_id TEXT,provider_name TEXT,provider_instance_id TEXT,resume_cursor_json TEXT)",
  );
  for (const provider of ["claudeAgent", "codex", "cursor"])
    db.prepare("INSERT INTO provider_session_runtime VALUES (?,?,?,?)").run(
      provider + "-conversation",
      provider,
      "example",
      JSON.stringify({ sessionId: "session", threadId: "session" }),
    );
  db.close();
}, 30000);
afterAll(() => rmSync(directory, { recursive: true, force: true }));
async function run(
  service: string,
  provider = "codex",
  input = '{"session_id":"session","tool_use_id":"call"}',
  flags: string[] = [],
  open = false,
  t3Home = directory,
) {
  const child = spawn(
    binary,
    [
      "hook",
      "post-tool-use",
      "--service",
      service,
      "--environment",
      "station",
      "--provider",
      provider,
      "--t3-home",
      t3Home,
      ...flags,
    ],
    { cwd: directory },
  );
  const start = performance.now();
  const exited = once(child, "exit");
  let stdout = "",
    stderr = "";
  child.stdout.on("data", (data) => (stdout += String(data)));
  child.stderr.on("data", (data) => (stderr += String(data)));
  if (open) child.stdin.write(input);
  else child.stdin.end(input);
  const [code] = await exited;
  return { code, stdout, stderr, ms: performance.now() - start };
}
test.each(["claude", "codex", "cursor"])(
  "compiled %s hook maps session and formats a notice",
  async (provider) => {
    const requests: unknown[] = [];
    const server = createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += String(chunk);
      requests.push(JSON.parse(body));
      expect(req.url).toBe("/api/agent-tools/notices");
      expect(req.headers.authorization).toBeUndefined();
      res.end(JSON.stringify({ notice: "Mail arrived." }));
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw Error("No port");
    try {
      const result = await run(`http://127.0.0.1:${address.port}`, provider);
      expect(result.code, result.stderr).toBe(0);
      expect(requests, result.stderr).toEqual([
        {
          environment: "station",
          threadId: (provider === "claude" ? "claudeAgent" : provider) + "-conversation",
          callId: "call",
        },
      ]);
      expect(JSON.parse(result.stdout)).toEqual(
        provider === "cursor"
          ? { additional_context: "Mail arrived." }
          : {
              hookSpecificOutput: {
                hookEventName: "PostToolUse",
                additionalContext: "Mail arrived.",
              },
            },
      );
    } finally {
      server.closeAllConnections();
      server.close();
    }
  },
);
test("hook bounds stdin, locked database, and an unanswered request by one total deadline", async () => {
  const server = createServer(() => {});
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw Error("No port");
  const url = `http://127.0.0.1:${address.port}`;
  const baseline = await run(url, "invalid");
  const db = new DatabaseSync(join(directory, "userdata/state.sqlite"));
  try {
    const stdin = await run(url, "codex", "{", ["--timeout-ms", "500"], true);
    db.exec("BEGIN EXCLUSIVE");
    const locked = await run(url, "codex", undefined, ["--timeout-ms", "500"]);
    db.exec("ROLLBACK");
    const waiting = await run(url, "codex", undefined, ["--timeout-ms", "500"]);
    for (const result of [stdin, locked, waiting]) {
      expect([result.code, result.stdout]).toEqual([0, ""]);
      expect(result.ms).toBeLessThan(500 + baseline.ms + 250);
      expect(result.stderr).not.toBe("");
    }
  } finally {
    db.close();
    server.closeAllConnections();
    server.close();
  }
});
test.each(["not json", "[]", '{"session_id":"missing"}', "x".repeat(1024 * 1024 + 1)])(
  "hook input failures write no stdout",
  async (input) => {
    const result = await run("http://127.0.0.1:1", "codex", input);
    expect([result.code, result.stdout]).toEqual([0, ""]);
  },
);
test.each([
  ["--unknown"],
  ["--timeout-ms", "99"],
  ["--timeout-ms", "10001"],
  ["--provider", "grok"],
])("hook rejects invalid flags %j", async (...flags) => {
  const result = await run("http://127.0.0.1:1", "codex", "", flags);
  expect([result.code, result.stdout]).toEqual([2, ""]);
});

test.each([null, {}, { notice: 7 }, { notice: "Mail" }])(
  "hook validates notice response %j",
  async (body) => {
    const server = createServer((_req, res) => res.end(JSON.stringify(body)));
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw Error("No port");
    try {
      const result = await run(`http://127.0.0.1:${address.port}`);
      expect(result.code).toBe(0);
      expect(result.stdout).toBe(
        body !== null && "notice" in body && body.notice === "Mail"
          ? JSON.stringify({
              hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "Mail" },
            }) + "\n"
          : "",
      );
    } finally {
      server.closeAllConnections();
      server.close();
    }
  },
);

test("OpenCode plugin asset sends a notice request and appends only valid notice text", async () => {
  const requests: unknown[] = [];
  let notice: string | null = "Mail arrived.";
  const server = createServer(async (req, res) => {
    let text = "";
    for await (const chunk of req) text += String(chunk);
    requests.push(JSON.parse(text));
    expect(req.headers.authorization).toBeUndefined();
    res.end(JSON.stringify({ notice }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw Error("No port");
  try {
    const spec = parse(
      readFileSync(
        new URL("../../../docs/specifications/host-cli-hook.yml", import.meta.url),
        "utf8",
      ),
    ) as { description: string };
    const source = spec.description
      .match(/```js\n([\s\S]*?)\n```/)![1]!
      .replace("http://127.0.0.1:8080", `http://127.0.0.1:${address.port}`);
    const module = (await import(
      "data:text/javascript;base64," + Buffer.from(source).toString("base64")
    )) as {
      Manifold: () => Promise<{
        "tool.execute.after": (
          input: { callID: string },
          output: { output: string },
        ) => Promise<void>;
      }>;
    };
    const hook = (await module.Manifold())["tool.execute.after"];
    const output = { output: "Tool completed." };
    await hook({ callID: "call" }, output);
    expect(requests).toEqual([{ environment: "workstation", callId: "call" }]);
    expect(output.output).toBe("Tool completed.\n\nMail arrived.");
    notice = null;
    await hook({ callID: "call" }, output);
    expect(output.output).toBe("Tool completed.\n\nMail arrived.");
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test("hook with an absent database sends nothing even with a tool call id", async () => {
  const requests: unknown[] = [];
  const server = createServer((_req, res) => {
    requests.push(true);
    res.end(JSON.stringify({ notice: "Mail" }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw Error("No port");
  try {
    const result = await run(
      `http://127.0.0.1:${address.port}`,
      "codex",
      undefined,
      [],
      false,
      join(directory, "absent"),
    );
    expect([result.code, result.stdout, requests.length]).toEqual([0, "", 0]);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test("hook rejects oversized valid JSON before sending", async () => {
  const requests: unknown[] = [];
  const server = createServer((_req, res) => {
    requests.push(true);
    res.end(JSON.stringify({ notice: "Mail" }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw Error("No port");
  try {
    const result = await run(
      `http://127.0.0.1:${address.port}`,
      "codex",
      JSON.stringify({
        session_id: "session",
        tool_use_id: "call",
        tool_response: "x".repeat(1024 * 1024),
      }),
    );
    expect([result.code, result.stdout, requests.length]).toEqual([0, "", 0]);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test("hook refuses an unknown provider before reading input", async () => {
  const result = await run("http://127.0.0.1:1", "grok");
  expect([result.code, result.stdout]).toEqual([2, ""]);
});
