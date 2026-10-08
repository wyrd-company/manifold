// ---
// relationships:
//   verifies: declarations-api
// ---
import { afterEach, expect, test, vi } from "vite-plus/test";
import { startService } from "../service/index.ts";
import { serviceFixture } from "../service/test-fixtures/repository.ts";
const closes: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of closes.splice(0).toReversed()) await close();
});
async function setup() {
  const fixture = await serviceFixture();
  closes.push(fixture.close);
  const service = await startService({ configurationFile: fixture.file, log: () => {} });
  closes.push(service.stop);
  return {
    fixture,
    service,
    url: `http://127.0.0.1:${service.http.address().port}/api/declarations`,
  };
}
test("reads absent declarations and rejects invalid paths and requests", async () => {
  const { url } = await setup();
  const response = await fetch(url + "/source?path=task-metadata.yml");
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    path: "task-metadata.yml",
    text: "",
    exists: false,
    findings: [],
    fields: [],
  });
  for (const [path, options, status] of [
    ["/unknown", {}, 404],
    ["/source?path=other.yml", {}, 400],
    ["/lint", { method: "GET" }, 405],
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
    ["/lint", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }, 400],
  ] as const) {
    expect((await fetch(url + path, options)).status).toBe(status);
  }
});
test("lints task drafts and edits without writing the repository", async () => {
  const { url, fixture } = await setup();
  const request = (path: string, body: unknown) =>
    fetch(url + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const syntax = await request("/lint", { path: "task-metadata.yml", text: "projects: [" });
  expect(await syntax.json()).toMatchObject({ findings: [{ kind: "syntax" }] });
  const edited = await request("/task-fields/edit", {
    text: "",
    edit: { kind: "add-field", binding: "sample" },
  });
  expect(edited.status).toBe(200);
  expect(await edited.json()).toMatchObject({
    location: "/projects/sample/fields/field-1",
    fields: [{ name: "field-1" }],
  });
  const invalid = await request("/save", {
    path: "task-metadata.yml",
    text: "projects: [",
    base: fixture.first,
    message: "Example change",
    saveId: "1".repeat(32),
  });
  expect(invalid.status).toBe(422);
});
test("rejects oversized bodies, malformed JSON and unexpected request members", async () => {
  const { url, fixture } = await setup();
  const request = (path: string, body: string) =>
    fetch(url + path, { method: "POST", headers: { "content-type": "application/json" }, body });
  expect((await request("/lint", " ".repeat(8 * 1024 * 1024 + 1))).status).toBe(413);
  expect((await request("/lint", "not JSON")).status).toBe(400);
  expect((await request("/lint", "null")).status).toBe(400);
  expect(
    (await request("/lint", JSON.stringify({ path: "bindings.yml", text: "", extra: true })))
      .status,
  ).toBe(400);
  expect(
    (
      await request(
        "/save",
        JSON.stringify({
          path: "bindings.yml",
          text: "",
          base: fixture.first,
          message: " ",
          saveId: "bad",
        }),
      )
    ).status,
  ).toBe(400);
});
test("rejects malformed field and binding edits and unknown bases", async () => {
  const { url, fixture } = await setup();
  const request = (path: string, body: unknown) =>
    fetch(url + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  expect(
    (
      await request("/task-fields/edit", {
        text: "",
        edit: {
          kind: "set-field",
          location: "/projects/sample/fields/Notes",
          values: { type: "unknown" },
        },
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request("/task-fields/edit", {
        text: "",
        edit: { kind: "remove-field", location: "/projects/sample/fields/Notes" },
      })
    ).status,
  ).toBe(422);
  const locked = await request("/task-fields/edit", {
    text: "projects:\n  sample:\n    lifecycle:\n      field: Stage\n      options: [Open]\n",
    edit: { kind: "remove-field", location: "/projects/sample/lifecycle" },
  });
  expect(locked.status).toBe(422);
  expect(await locked.json()).toMatchObject({ findings: [{ kind: "field-locked" }] });
  expect(
    (
      await request("/bindings/save", {
        edit: { kind: "other" },
        base: fixture.first,
        message: "Example",
        saveId: "1".repeat(32),
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request("/bindings/save", {
        edit: {
          kind: "t3code-project",
          mode: "add",
          name: "sample",
          environment: "local",
          project: "workspace",
          item: "garden",
        },
        base: "a".repeat(40),
        message: "Example",
        saveId: "1".repeat(32),
      })
    ).status,
  ).toBe(400);
});

test("rejects coerced enum values and invalid new bindings while editing existing invalid keys", async () => {
  const { url, fixture } = await setup();
  const request = (path: string, body: unknown) =>
    fetch(url + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  expect(
    (
      await request("/task-fields/edit", {
        text: "",
        edit: {
          kind: "set-field",
          location: "/projects/sample/fields/Notes",
          values: { type: ["text"] },
        },
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request("/bindings/save", {
        base: fixture.first,
        message: "Example",
        saveId: "1".repeat(32),
        edit: {
          kind: "t3code-project",
          mode: ["add"],
          name: "sample",
          environment: "local",
          project: "workspace",
          item: "garden",
        },
      })
    ).status,
  ).toBe(400);
  for (const binding of ["bad--name", "bad-", "x".repeat(65)])
    expect(
      (await request("/task-fields/edit", { text: "", edit: { kind: "add-field", binding } }))
        .status,
    ).toBe(400);
  expect(
    (
      await request("/task-fields/edit", {
        text: "projects:\n  Invalid name:\n    lifecycle:\n      field: Stage\n      options: [Open]\n",
        edit: { kind: "add-field", binding: "Invalid name" },
      })
    ).status,
  ).toBe(200);
});
test("answers unavailable before an applied revision", async () => {
  const { url, service } = await setup();
  const latest = vi.spyOn(service.revisions, "latest").mockReturnValue(undefined);
  try {
    expect((await fetch(url + "/source?path=bindings.yml")).status).toBe(503);
  } finally {
    latest.mockRestore();
  }
});
test("shows non-string Project keys as written and adds a field by that key", async () => {
  const { url } = await setup();
  const request = (path: string, body: unknown) =>
    fetch(url + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const text =
    'projects:\n  001:\n    lifecycle:\n      field: Stage\n      options: [Open]\n    fields:\n      002:\n        type: ""\n        storage:\n          kind: unknown\n';
  const lint = await request("/lint", { path: "task-metadata.yml", text });
  expect(await lint.json()).toMatchObject({
    fields: [
      { binding: "001", name: "Stage", location: "/projects/1/lifecycle" },
      {
        binding: "001",
        name: "002",
        type: "",
        storage: "unknown",
        location: "/projects/1/fields/2",
      },
    ],
  });
  const edit = await request("/task-fields/edit", {
    text,
    edit: { kind: "add-field", binding: "001" },
  });
  expect(edit.status).toBe(200);
  expect(await edit.json()).toMatchObject({
    location: "/projects/1/fields/field-1",
    text: expect.stringContaining("  001:\n"),
    fields: [
      { binding: "001" },
      { binding: "001", name: "002" },
      { binding: "001", name: "field-1" },
    ],
  });
});

test("an empty portfolio item gives a binding finding instead of a malformed request", async () => {
  const { url, fixture } = await setup();
  const response = await fetch(url + "/bindings/save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      edit: {
        kind: "github-project",
        mode: "add",
        name: "sample",
        owner: "example",
        number: 1,
        environment: "local",
        item: "",
        t3codeProjects: [],
      },
      base: fixture.first,
      message: "Example binding",
      saveId: "1".repeat(32),
    }),
  });
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({
    findings: [expect.objectContaining({ location: "/githubProjects/sample/item" })],
  });
});

test("reads and lints accounts with configured environments and portfolio warnings", async () => {
  const { url } = await setup();
  const source = await fetch(url + "/source?path=accounts.yml");
  expect(source.status).toBe(200);
  expect(await source.json()).toMatchObject({
    path: "accounts.yml",
    environments: expect.any(Array),
    findings: [],
  });
  const lint = await fetch(url + "/lint", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: "accounts.yml", text: "accounts: [" }),
  });
  expect(await lint.json()).toMatchObject({ findings: [{ file: "accounts", kind: "syntax" }] });
});
