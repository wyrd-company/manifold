// ---
// relationships:
//   verifies: [operator-console, actors-api]
// ---
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { request } from "node:http";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parse } from "yaml";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { openStore } from "../store/index.ts";
import { mountConsole } from "./index.ts";
import { consoleHost } from "./test-fixtures/host.ts";

let root: string;
let store: ReturnType<typeof openStore>;
let server: Awaited<ReturnType<typeof consoleHost>>;
let clock = 0;
beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "console-test-"));
  writeFileSync(join(root, "index.html"), "<html>sample shell</html>");
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "assets/sample-abc123.js"), "sample");
  store = openStore({ path: join(root, "store.db"), now: () => clock });
  server = await consoleHost("sample-token");
  mountConsole(server.host, { root, store });
});
afterEach(async () => {
  await server.close();
  store.close();
  rmSync(root, { recursive: true, force: true });
});
const read = (path = "/api/actors", method = "GET", token = "sample-token") =>
  fetch(server.url + path, { method, headers: { Authorization: `Bearer ${token}` } });

test("lists active snapshots, projects identity, leaves, versions and deterministic order against OpenAPI", async () => {
  clock = 1000;
  store.saveSnapshot({
    actorId: "older",
    machine: "sample",
    snapshot: { status: "active", value: "ready", context: null },
  });
  clock = 2000;
  store.saveSnapshot({
    actorId: "b",
    machine: "sample",
    snapshot: {
      status: "active",
      value: "waiting",
      context: { manifold: { environment: 42, issue: "sample#2" } },
    },
  });
  store.saveSnapshot({
    actorId: "a",
    machine: `${"a".repeat(40)}:blueprints/sample.yml`,
    snapshot: {
      status: "active",
      value: { working: { first: "ready", second: "waiting" } },
      context: {
        manifold: {
          environment: "sample-host",
          project: "sample-project",
          issue: "sample#1",
          portfolioItem: "sample-item",
        },
      },
    },
  });
  store.saveSnapshot({
    actorId: "ended",
    machine: "sample",
    snapshot: { status: "done", value: "finished" },
  });
  store.saveSnapshot({
    actorId: "stopped",
    machine: "sample",
    snapshot: { status: "stopped", value: "finished" },
  });
  store.saveSnapshot({
    actorId: "error",
    machine: "sample",
    snapshot: { status: "error", error: "sample" },
  });
  const response = await read("/api/actors?ignored=yes");
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("content-type")).toContain("application/json");
  const body = await response.json();
  expect(body).toEqual({
    actors: [
      {
        actorId: "a",
        machine: `${"a".repeat(40)}:blueprints/sample.yml`,
        blueprint: { commit: "a".repeat(40), path: "blueprints/sample.yml" },
        states: ["working.first.ready", "working.second.waiting"],
        environment: "sample-host",
        project: "sample-project",
        issue: "sample#1",
        portfolioItem: "sample-item",
        savedAt: new Date(2000).toISOString(),
      },
      {
        actorId: "b",
        machine: "sample",
        states: ["waiting"],
        issue: "sample#2",
        savedAt: new Date(2000).toISOString(),
      },
      {
        actorId: "older",
        machine: "sample",
        states: ["ready"],
        savedAt: new Date(1000).toISOString(),
      },
    ],
  });
  const document = parse(
    readFileSync(
      new URL("../../../../docs/specifications/actors-api.openapi.yml", import.meta.url),
      "utf8",
    ),
  );
  const validate = new Ajv2020({ strict: false, validateFormats: false }).compile({
    ...document.components.schemas.ActorsResponse,
    components: document.components,
  });
  expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
  clock = 3000;
  store.saveSnapshot({
    actorId: "older",
    machine: "sample",
    snapshot: { status: "active", value: "changed", context: { manifold: [] } },
  });
  expect((await (await read()).json()).actors[0].states).toEqual(["changed"]);
});
test("empty results, authentication, methods, and paths", async () => {
  expect(await (await read()).json()).toEqual({ actors: [] });
  expect((await read("/api/actors", "GET", "wrong")).status).toBe(401);
  const response = await read("/api/actors", "POST");
  expect(response.status).toBe(405);
  expect(response.headers.get("allow")).toBe("GET");
  expect((await read("/api/actors/other")).status).toBe(404);
  const disabled = await consoleHost(undefined);
  try {
    mountConsole(disabled.host, { root, store });
    expect((await fetch(disabled.url + "/api/actors")).status).toBe(404);
  } finally {
    await disabled.close();
  }
});
test("failed reads return no error detail and log the path", async () => {
  const errors: unknown[] = [];
  const failing = await consoleHost("sample-token");
  try {
    mountConsole(failing.host, {
      root,
      store: {
        activeSnapshots() {
          throw new Error("private sample");
        },
      },
      log: (entry) => errors.push(entry),
    });
    const response = await fetch(failing.url + "/api/actors", {
      headers: { Authorization: "Bearer sample-token" },
    });
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ path: "/api/actors" });
  } finally {
    await failing.close();
  }
});
test("serves routes, assets, HEAD, redirect and security headers without authentication", async () => {
  const response = await fetch(server.url + "/console/actors");
  expect(await response.text()).toBe("<html>sample shell</html>");
  expect(response.headers.get("cache-control")).toBe("no-cache");
  expect(response.headers.get("content-security-policy")).toBe(
    "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'",
  );
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  const asset = await fetch(server.url + "/console/assets/sample-abc123.js");
  expect(await asset.text()).toBe("sample");
  expect(asset.headers.get("cache-control")).toContain("immutable");
  expect((await fetch(server.url + "/console/missing.js")).status).toBe(404);
  expect((await fetch(server.url + "/console/assets/missing")).status).toBe(404);
  expect(
    (await fetch(server.url + "/console/actors", { method: "HEAD" })).headers.get("content-length"),
  ).toBe(String("<html>sample shell</html>".length));
  expect(
    (await fetch(server.url + "/console", { redirect: "manual" })).headers.get("location"),
  ).toBe("/console/");
  expect((await fetch(server.url + "/console/", { method: "POST" })).status).toBe(405);
  expect((await fetch(server.url + "/")).status).toBe(404);
});
test("rejects traversal before path normalization and malformed escapes", async () => {
  for (const path of [
    "/console/../store.db",
    "/console/../route",
    "/console/%5c..%5croute",
    "/console/%5croute",
    "/console/%00route",
    "/console/%2e%2e/store.db",
    "/console/%2e%2e%2fstore.db",
    "/console/%",
    "/console/%5c..%5cstore.db",
  ]) {
    const status = await new Promise<number>((resolve, reject) => {
      request(server.url, { path }, (response) => {
        response.resume();
        resolve(response.statusCode!);
      })
        .on("error", reject)
        .end();
    });
    expect(status, path).toBe(404);
  }
});
test("refuses an incomplete console build at mount", () => {
  expect(() => mountConsole(server.host, { root: join(root, "absent"), store })).toThrow(
    /index.html/,
  );
});
