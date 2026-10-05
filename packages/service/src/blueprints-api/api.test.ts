// ---
// relationships:
//   verifies: blueprints-api
// ---
import { afterEach, expect, test } from "vite-plus/test";
import { startService } from "../service/index.ts";
import { serviceFixture } from "../service/test-fixtures/repository.ts";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";
const document = parse(
  await readFile(
    new URL("../../../../docs/specifications/blueprints-api.openapi.yml", import.meta.url),
    "utf8",
  ),
) as { components: { schemas: Record<string, object> } };
const validators = new Map<string, ValidateFunction>();
function conforms(schema: string, body: unknown) {
  let validate = validators.get(schema);
  if (!validate) {
    validate = new Ajv2020({ strict: false }).compile({
      $ref: `#/components/schemas/${schema}`,
      components: document.components,
    });
    validators.set(schema, validate);
  }
  expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
  return body;
}
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanups.splice(0).toReversed()) await close();
});
async function setup() {
  const fixture = await serviceFixture();
  cleanups.push(fixture.close);
  const service = await startService({ configurationFile: fixture.file, log: () => {} });
  cleanups.push(service.stop);
  return {
    fixture,
    service,
    url: `http://127.0.0.1:${service.http.address().port}/api/blueprints`,
  };
}
test("lists, reads, and lints through the HTTP host with source ranges and graph", async () => {
  const { fixture, service, url } = await setup();
  service.store.saveSnapshot({
    actorId: "sample",
    machine: `${fixture.first}:blueprints/counter.yml`,
    snapshot: { status: "active", value: "counting" },
  });
  const response = await fetch(url);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(conforms("BlueprintsResponse", await response.json())).toMatchObject({
    commit: fixture.first,
    blueprints: [{ path: "blueprints/counter.yml", status: "loaded", activeActors: 1 }],
  });
  const source = await fetch(url + "/source?path=blueprints%2Fcounter.yml");
  expect(source.status).toBe(200);
  expect(conforms("BlueprintSource", await source.json())).toMatchObject({
    path: "blueprints/counter.yml",
    graph: { states: [{ path: "counting" }, { path: "done" }] },
    findings: [],
  });
  const lint = await fetch(url + "/lint", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: "blueprints/new.yml", text: "machine: [" }),
  });
  expect(lint.status).toBe(200);
  expect(conforms("LintResponse", await lint.json())).toMatchObject({
    findings: [{ kind: "yaml", range: { line: 1 } }],
  });
});
test("request boundary rejects bad paths, methods, media, cross-site requests and oversized bodies", async () => {
  const { url } = await setup();
  for (const [suffix, options, status] of [
    ["/unknown", {}, 404],
    ["", { method: "POST" }, 405],
    ["/source?path=../a.yml", {}, 400],
    ["/source?path=blueprints/missing.yml", {}, 404],
    ["/lint", { method: "POST", body: "{}" }, 415],
    [
      "/lint",
      {
        method: "POST",
        headers: { "content-type": "application/json", "sec-fetch-site": "cross-site" },
        body: "{}",
      },
      403,
    ],
    [
      "/lint",
      {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://other.test" },
        body: "{}",
      },
      403,
    ],
    [
      "/lint",
      { method: "POST", headers: { "content-type": "application/json" }, body: "invalid" },
      400,
    ],
    [
      "/lint",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: " ".repeat(8 * 1024 * 1024 + 1),
      },
      413,
    ],
  ] as const)
    expect((await fetch(url + suffix, options)).status).toBe(status);
  const forwarded = await fetch(url + "/lint", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://console.test",
      "x-forwarded-host": "console.test",
    },
    body: JSON.stringify({ path: "blueprints/a.yml", text: "" }),
  });
  expect(forwarded.status).toBe(200);
  for (const authority of ["console.test/path", "user@console.test"]) {
    const malformedHost = await fetch(url + "/lint", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://console.test",
        "x-forwarded-host": authority,
      },
      body: JSON.stringify({ path: "blueprints/a.yml", text: "" }),
    });
    expect(malformedHost.status).toBe(403);
  }
  const canonicalOrigin = await fetch(url + "/lint", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://console.test",
      "x-forwarded-host": "CONSOLE.TEST:443",
    },
    body: JSON.stringify({ path: "blueprints/a.yml", text: "" }),
  });
  expect(canonicalOrigin.status).toBe(200);
  const invalid = await fetch(url + "/save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      path: "blueprints/a.yml",
      base: "a".repeat(40),
      text: "bad",
      message: "change",
      saveId: "a".repeat(32),
    }),
  });
  expect(invalid.status).toBe(422);
  conforms("SaveInvalid", await invalid.json());
});

test("bundled paths list once, count older bundled actors and save as repository replacements", async () => {
  const { service, fixture } = await setup();
  const { createHttpHost } = await import("../http-host/index.ts");
  const { mountBlueprintsApi } = await import("./index.ts");
  const host = createHttpHost({
    configuration: { host: "127.0.0.1", port: 0 },
    onError: (error) => {
      throw error;
    },
  });
  cleanups.push(host.close);
  const text = (await service.processRepository.current()!.read("blueprints/counter.yml"))!;
  const digest = "e".repeat(64);
  mountBlueprintsApi(host, {
    revisions: service.revisions,
    processRepository: service.processRepository,
    store: service.store,
    repository: { url: fixture.remote.url, branch: "main" },
    configurationBound: 10000,
    bundle: {
      digest,
      blueprints: new Map([
        ["blueprints/counter.yml", text],
        ["blueprints/other.yaml", text],
        ["blueprints/aaa.yml", text],
      ]),
    },
    log: () => {},
  });
  service.store.saveSnapshot({
    actorId: "older",
    machine: `${"b".repeat(40)}:blueprints/counter.yml@${digest}`,
    snapshot: { status: "active", value: "counting" },
  });
  const address = await host.listen();
  const url = `http://127.0.0.1:${address.port}/api/blueprints`;
  const list = await fetch(url).then((r) => r.json());
  expect(list).toMatchObject({
    blueprints: [
      { path: "blueprints/aaa.yml", source: "bundled", bundle: digest },
      {
        path: "blueprints/counter.yml",
        source: "repository",
        replacesBundled: true,
        activeActors: 1,
      },
      { path: "blueprints/other.yaml", source: "bundled", bundle: digest },
    ],
  });
  expect(
    await fetch(url + "/source?path=blueprints/other.yaml").then((r) => r.json()),
  ).toMatchObject({ source: "bundled", text, commit: fixture.first, bundle: digest });
  const git = (await import("isomorphic-git")).default;
  const fs = await import("node:fs/promises");
  await git.setConfig({
    fs,
    gitdir: fixture.remote.gitdir,
    path: "http.receivepack",
    value: "true",
  });
  const saved = await fetch(url + "/save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      path: "blueprints/other.yaml",
      base: fixture.first,
      text,
      message: "Add recipe",
      saveId: "b".repeat(32),
    }),
  });
  expect(saved.status).toBe(200);
  expect(conforms("SaveResponse", await saved.json())).toMatchObject({
    outcome: "saved",
    blueprint: { path: "blueprints/other.yaml", source: "repository", replacesBundled: true },
  });
});

test("before the first revision serves bundled text and refuses repository reads and saves", async () => {
  const { service, fixture } = await setup();
  const { createHttpHost } = await import("../http-host/index.ts");
  const { mountBlueprintsApi } = await import("./index.ts");
  const host = createHttpHost({
    configuration: { host: "127.0.0.1", port: 0 },
    onError: (error) => {
      throw error;
    },
  });
  cleanups.push(host.close);
  const text = (await service.processRepository.current()!.read("blueprints/counter.yml"))!;
  mountBlueprintsApi(host, {
    revisions: { latest: () => undefined, save: service.revisions.save },
    processRepository: service.processRepository,
    store: service.store,
    repository: { url: fixture.remote.url, branch: "main" },
    configurationBound: 10000,
    bundle: { digest: "e".repeat(64), blueprints: new Map([["blueprints/other.yaml", text]]) },
    log: () => {},
  });
  const address = await host.listen();
  const url = `http://127.0.0.1:${address.port}/api/blueprints`;
  const list = await fetch(url).then((r) => r.json());
  expect(list).not.toHaveProperty("commit");
  expect(list).toMatchObject({ blueprints: [{ source: "bundled" }] });
  const source = await fetch(url + "/source?path=blueprints/other.yaml").then((r) => r.json());
  expect(source).not.toHaveProperty("commit");
  expect(source).toMatchObject({ text, source: "bundled" });
  expect((await fetch(url + "/source?path=blueprints/counter.yml")).status).toBe(503);
  expect(
    (
      await fetch(url + "/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: "blueprints/other.yaml",
          base: fixture.first,
          text,
          message: "Add recipe",
          saveId: "b".repeat(32),
        }),
      })
    ).status,
  ).toBe(503);
});

test("save shape rejects malformed identities and messages before touching the remote", async () => {
  const { url, fixture, service } = await setup();
  const text = (await service.processRepository.current()!.read("blueprints/counter.yml"))!;
  const valid = {
    path: "blueprints/counter.yml",
    base: fixture.first,
    text,
    message: "Change recipe",
    saveId: "a".repeat(32),
  };
  for (const override of [
    { path: "blueprints/../a.yml" },
    { path: "blueprints//a.yml" },
    { path: "blueprints/a\\b.yml" },
    { base: "bad" },
    { saveId: "bad" },
    { message: " " },
    { message: "x".repeat(4097) },
    { extra: true },
  ]) {
    const response = await fetch(url + "/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...valid, ...override }),
    });
    expect(response.status).toBe(400);
    conforms("Error", await response.json());
  }
});

test("HTTP save loads one commit, retries once and reports the remote same-file conflict", async () => {
  const { url, fixture, service } = await setup();
  const git = (await import("isomorphic-git")).default;
  const fs = await import("node:fs/promises");
  await git.setConfig({
    fs,
    gitdir: fixture.remote.gitdir,
    path: "http.receivepack",
    value: "true",
  });
  const text = (await service.processRepository.current()!.read("blueprints/counter.yml"))!.replace(
    "count: 60",
    "count: 61",
  );
  const request = {
    path: "blueprints/counter.yml",
    base: fixture.first,
    text,
    message: "Change recipe",
    saveId: "a".repeat(32),
  };
  const send = (body: unknown) =>
    fetch(url + "/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const saved = await send(request);
  expect(saved.status).toBe(200);
  const result = (await saved.json()) as { commit: string };
  conforms("SaveResponse", result);
  expect(result).toMatchObject({
    outcome: "saved",
    blueprint: { commit: result.commit, status: "loaded" },
  });
  const again = await send(request);
  expect(again.status).toBe(200);
  expect(await again.json()).toMatchObject({ outcome: "already-saved", commit: result.commit });
  const conflict = await send({
    ...request,
    saveId: "b".repeat(32),
    text: text.replace("61", "62"),
  });
  expect(conflict.status).toBe(409);
  expect(conforms("SaveConflict", await conflict.json())).toMatchObject({
    reason: "file-changed",
    head: result.commit,
    text,
  });
  expect(await git.log({ fs, gitdir: fixture.remote.gitdir, ref: "main" })).toHaveLength(2);
});

test("maps follower failures to remote errors, stopped service, and logged internal failures", async () => {
  const { service, fixture } = await setup();
  const { createHttpHost } = await import("../http-host/index.ts");
  const { mountBlueprintsApi } = await import("./index.ts");
  const { ProcessRepositorySaveError, ProcessRepositoryPullError } =
    await import("../process-repository/index.ts");
  const text = (await service.processRepository.current()!.read("blueprints/counter.yml"))!;
  const cases = [
    {
      cause: new ProcessRepositorySaveError(
        "authentication",
        fixture.first,
        "Remote refused authentication",
      ),
      status: 502,
      error: "authentication",
    },
    {
      cause: new ProcessRepositorySaveError("rejected", fixture.first, "Policy refusal"),
      status: 502,
      error: "rejected",
    },
    {
      cause: new ProcessRepositoryPullError("incomplete", "Incomplete remote"),
      status: 502,
      error: "remote",
    },
    { cause: new TypeError("Revision follower is closed"), status: 503, error: "unavailable" },
    { cause: new Error("Example failure"), status: 500, error: "internal" },
  ];
  for (const entry of cases) {
    const logs: unknown[] = [];
    const host = createHttpHost({
      configuration: { host: "127.0.0.1", port: 0 },
      onError: (error) => {
        throw error;
      },
    });
    cleanups.push(host.close);
    mountBlueprintsApi(host, {
      revisions: {
        latest: service.revisions.latest,
        save: async () => {
          throw entry.cause;
        },
      },
      processRepository: service.processRepository,
      store: service.store,
      repository: { url: fixture.remote.url, branch: "main" },
      configurationBound: 10000,
      bundle: { digest: "", blueprints: new Map() },
      log: (log) => logs.push(log),
    });
    const address = await host.listen();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/blueprints/save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: "blueprints/counter.yml",
        base: fixture.first,
        text,
        message: "Change recipe",
        saveId: "a".repeat(32),
      }),
    });
    expect(response.status).toBe(entry.status);
    const body = await response.json();
    expect(body).toMatchObject({ error: entry.error });
    if (entry.status === 502) conforms("SaveRemoteError", body);
    if (entry.status === 503) conforms("Error", body);
    expect(logs).toHaveLength(entry.status === 500 ? 1 : 0);
  }
});

test("HTTP lint, the loader and host CLI agree on all token fixtures", async () => {
  const { url, service, fixture } = await setup();
  const { fixtures } = await import("../../../shared/src/token-lint/test-fixtures/blueprints.ts");
  const { memoryRevision } = await import("@wyrd-company/manifold-shared");
  const { blueprintLintCommand } = await import("../../../host-cli/src/blueprint-lint/command.ts");
  const { stringify } = await import("yaml");
  const fs = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { vi } = await import("vite-plus/test");
  let index = 0;
  for (const [name, document] of fixtures) {
    const text = stringify(document);
    const path = "blueprints/recipe.yml";
    const revision = memoryRevision((++index).toString(16).padStart(40, "0"), { [path]: text });
    const loaded = await service.blueprints.loadRevision(revision);
    const response = await fetch(url + "/lint", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, text }),
    });
    expect(response.status, name).toBe(200);
    const lint = (await response.json()) as {
      findings: {
        kind: string;
        location: string;
        message: string;
        range: { from: number; to: number };
      }[];
      warnings: {
        kind: string;
        location: string;
        message: string;
        range: { from: number; to: number };
      }[];
    };
    conforms("LintResponse", lint);
    const problems = loaded.failures.get(path) ?? [];
    const warnings = loaded.blueprints.get(path)?.warnings ?? [];
    expect(
      lint.findings.map(({ range: _range, ...finding }) => finding),
      name,
    ).toEqual(problems.map(({ path: _path, ...finding }) => finding));
    expect(
      lint.warnings.map(({ range: _range, ...finding }) => finding),
      name,
    ).toEqual(warnings.map(({ path: _path, ...finding }) => finding));
    const file = join(fixture.directory, "recipe.yml");
    await fs.writeFile(file, text);
    const output: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((value) => output.push(String(value)));
    try {
      const code = await blueprintLintCommand([
        "--configuration-bound",
        String(service.configuration.blueprintLint.configurationBound),
        file,
      ]);
      expect(code, name).toBe(lint.findings.length ? 1 : 0);
      expect(output, name).toHaveLength(lint.findings.length + lint.warnings.length);
      for (const [i, finding] of [...lint.findings, ...lint.warnings].entries()) {
        expect(output[i], name).toContain(
          `${file}:${finding.location} ${finding.kind} ${finding.message.replaceAll(/\r?\n/g, " ")}`,
        );
        expect(finding.range.from, name).toBeLessThanOrEqual(finding.range.to);
        expect(finding.range.to, name).toBeLessThanOrEqual(text.length);
      }
    } finally {
      log.mockRestore();
    }
  }
}, 30000);

test("an invalid repository blueprint replaces its bundled path and exposes the same source findings", async () => {
  const { service, fixture } = await setup();
  const { createHttpHost } = await import("../http-host/index.ts");
  const { mountBlueprintsApi } = await import("./index.ts");
  const valid = (await service.processRepository.current()!.read("blueprints/counter.yml"))!;
  const commit = await fixture.commit(
    60,
    {},
    {
      machine: { initial: "absent", states: { idle: {} } },
      schemas: { input: true, output: true, context: true, events: {} },
    },
  );
  await service.revisions.pull();
  const host = createHttpHost({
    configuration: { host: "127.0.0.1", port: 0 },
    onError: (error) => {
      throw error;
    },
  });
  cleanups.push(host.close);
  mountBlueprintsApi(host, {
    revisions: service.revisions,
    processRepository: service.processRepository,
    store: service.store,
    repository: { url: fixture.remote.url, branch: "main" },
    configurationBound: 10000,
    bundle: { digest: "e".repeat(64), blueprints: new Map([["blueprints/counter.yml", valid]]) },
    log: () => {},
  });
  const address = await host.listen();
  const url = `http://127.0.0.1:${address.port}/api/blueprints`;
  expect(conforms("BlueprintsResponse", await fetch(url).then((r) => r.json()))).toMatchObject({
    commit,
    blueprints: [{ source: "repository", replacesBundled: true, status: "invalid", findings: 2 }],
  });
  const source = conforms(
    "BlueprintSource",
    await fetch(url + "/source?path=blueprints/counter.yml").then((r) => r.json()),
  );
  expect(source).toMatchObject({
    source: "repository",
    commit,
    findings: expect.arrayContaining([expect.objectContaining({ kind: "machine" })]),
  });
  expect(source).not.toHaveProperty("graph");
});
