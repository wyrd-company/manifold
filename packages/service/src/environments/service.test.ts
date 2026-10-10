// ---
// relationships:
//   verifies: [environment-control, environments-api, environment-events]
// ---
import { afterEach, expect, test, inject } from "vite-plus/test";
import { fork } from "node:child_process";
import { join } from "node:path";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parse } from "yaml";
import { environmentFixture } from "./test-fixtures/setup.ts";
import { startService } from "../service/index.ts";
import {
  isEnvironmentSummary,
  isEnvironmentsResponse,
} from "@wyrd-company/manifold-shared/environments-api";
const closes: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of closes.splice(0).toReversed()) await close();
});
test("HTTP actions follow the API schema, path rules, counts and independent holds", async () => {
  const f = await environmentFixture();
  closes.push(f.close);
  const service = await startService({ configurationFile: f.file, log: () => {} });
  closes.push(service.stop);
  await Promise.all([service.t3code.ready("station"), service.t3code.ready("depot")]);
  const address = service.http.address(),
    base = `http://${address.host}:${address.port}/api/environments`;
  const api = parse(
    await readFile(
      new URL("../../../../docs/specifications/environments-api.openapi.yml", import.meta.url),
      "utf8",
    ),
  );
  const validator = new Ajv2020({ strict: false, validateFormats: false }).compile({
    components: api.components,
    ...api.components.schemas.EnvironmentsResponse,
  });
  const listed = await fetch(base),
    body = await listed.json();
  expect(listed.headers.get("cache-control")).toBe("no-store");
  expect(isEnvironmentsResponse(body)).toBe(true);
  expect(validator(body)).toBe(true);
  expect(body.environments.map((e: { name: string }) => e.name)).toEqual(["station", "depot"]);
  for (const [action, paused, disconnected] of [
    ["pause", true, false],
    ["disconnect", true, true],
    ["resume", false, true],
    ["reconnect", false, false],
  ] as const) {
    const response = await fetch(`${base}/station/${action}`, { method: "POST", body: "ignored" });
    expect(response.status).toBe(200);
    const summary = await response.json();
    expect(isEnvironmentSummary(summary)).toBe(true);
    expect(summary).toMatchObject({
      name: "station",
      paused,
      disconnected,
      activeThreads: summary.connection === "connected" ? 0 : null,
    });
    expect(service.environments.held("depot").sequence).toBe(0);
  }
  service.environments.act("station", "pause");
  const sequence = service.environments.held("station").sequence;
  await fetch(`${base}/station/pause`, { method: "POST" });
  expect(service.environments.held("station").sequence).toBe(sequence);
  for (const [path, method, code, kind, allow] of [
    ["/absent/pause", "POST", 404, "unknown-environment", null],
    ["/station/absent", "POST", 404, "unknown-action", null],
    ["/station", "GET", 404, "not-found", null],
    ["", "POST", 405, "method-not-allowed", "GET"],
    ["/station/pause", "GET", 405, "method-not-allowed", "POST"],
  ] as const) {
    const response = await fetch(base + path, { method });
    expect(response.status).toBe(code);
    expect(await response.json()).toMatchObject({ error: { kind } });
    expect(response.headers.get("allow")).toBe(allow);
  }
});
test("SIGKILL on a paused thread-create restores the hold and invoke; resume creates one thread", async () => {
  const f = await environmentFixture();
  closes.push(f.close);
  function start(pause = false) {
    const child = fork(
      join(inject("childArtifacts").service, "environments/test-fixtures/control-worker.js"),
      [f.file, ...(pause ? ["pause"] : [])],
      { execArgv: [], stdio: ["ignore", "pipe", "pipe", "ipc"] },
    );
    let stderr = "";
    child.stderr!.on("data", (chunk) => {
      stderr += String(chunk);
    });
    const messages: unknown[] = [];
    child.on("message", (message) => messages.push(message));
    closes.push(async () => {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = once(child, "exit");
        child.kill("SIGKILL");
        await exited;
      }
    });
    const address = new Promise<{ host: string; port: number }>((resolve, reject) => {
      child.on("message", (message) => {
        if (message && typeof message === "object" && "address" in message)
          resolve(message.address as { host: string; port: number });
      });
      child.once("exit", () => reject(new Error(stderr)));
    });
    return { child, address, messages };
  }
  const first = start(true),
    firstAddress = await first.address;
  const base1 = `http://${firstAddress.host}:${firstAddress.port}/api/environments`;
  await expect
    .poll(async () => (await (await fetch(base1)).json()).environments[0].scheduledThreads)
    .toBe(1);
  expect(f.servers[0]!.threads.size).toBe(0);
  const exited = once(first.child, "exit");
  first.child.kill("SIGKILL");
  expect((await exited)[1]).toBe("SIGKILL");
  const second = start(),
    secondAddress = await second.address;
  const base2 = `http://${secondAddress.host}:${secondAddress.port}/api/environments`;
  await expect
    .poll(async () => (await (await fetch(base2)).json()).environments[0].scheduledThreads)
    .toBe(1);
  expect((await (await fetch(base2)).json()).environments[0]).toMatchObject({ paused: true });
  expect(f.servers[0]!.threads.size).toBe(0);
  expect((await fetch(base2 + "/station/resume", { method: "POST" })).status).toBe(200);
  await expect.poll(() => f.servers[0]!.threads.size).toBe(1);
  await expect
    .poll(async () => (await (await fetch(base2)).json()).environments[0].scheduledThreads)
    .toBe(0);
  second.child.send("snapshot");
  await expect
    .poll(() =>
      second.messages.some((message) => JSON.stringify(message).includes('"value":"waiting"')),
    )
    .toBe(true);
  expect(f.servers[0]!.commands).toHaveLength(1);
  const stopped = once(second.child, "exit");
  second.child.send("stop");
  await stopped;
});
