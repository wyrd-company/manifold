// ---
// relationships:
//   verifies: [declarations-api, portfolio-api]
// ---
import { expect, test } from "vite-plus/test";
import { archiveFixture } from "../portfolio-api/test-fixtures/archive.ts";
import {
  isSaveInvalidResponse,
  isLintDeclarationResponse,
} from "@wyrd-company/manifold-shared/declarations-api";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parse } from "yaml";
import { readFile } from "node:fs/promises";
const contract = parse(
  await readFile(
    new URL("../../../../docs/specifications/declarations-api.openapi.yml", import.meta.url),
    "utf8",
  ),
) as { components: { schemas: Record<string, object> } };
const ajv = new Ajv2020({ strict: false, validateFormats: false });
const validate = ajv.compile({
  ...contract.components.schemas["Findings"],
  components: contract.components,
});
test("archive validates requests and both files without writing, and preview reads and lint agree", async () => {
  const f = await archiveFixture();
  try {
    const post = (body: unknown) =>
      fetch(f.url + "/api/declarations/archive-item", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const base = {
      item: "beta",
      projects: [],
      base: f.base,
      message: "Archive sample item",
      saveId: "4".repeat(32),
    };
    for (const body of [
      { ...base, extra: true },
      { ...base, item: "" },
      {
        ...base,
        projects: [
          { created: { environment: "local", project: "" }, name: "chosen", choice: "archive" },
        ],
      },
      {
        ...base,
        projects: [
          {
            created: { environment: "local", project: "p1", extra: true },
            name: "chosen",
            choice: "archive",
          },
        ],
      },
      {
        ...base,
        projects: [
          {
            binding: "board-one",
            created: { environment: "local", project: "p1" },
            name: "chosen",
            choice: "archive",
          },
        ],
      },
      {
        ...base,
        projects: [
          { created: { environment: "local", project: "p1" }, name: "Bad name", choice: "archive" },
        ],
      },
      { ...base, projects: [{ binding: "board-one", choice: "reassign" }] },
      { ...base, projects: [{ binding: "board-one", choice: "move", item: "alpha" }] },
    ])
      expect((await post(body)).status).toBe(400);
    expect((await post({ ...base, base: "f".repeat(40) })).status).toBe(400);
    const invalid = await post(base);
    expect(invalid.status).toBe(422);
    const findings: unknown = await invalid.json();
    expect(isSaveInvalidResponse(findings)).toBe(true);
    expect(findings).toMatchObject({
      findings: [
        { file: "bindings", kind: "archived-item" },
        { file: "bindings", kind: "archived-item" },
      ],
    });
    const after = await fetch(f.url + "/api/portfolio").then((r) => r.json());
    expect(after.commit).toBe(f.base);
    const source = await fetch(f.url + "/api/declarations/source?path=portfolio.yml").then((r) =>
      r.json(),
    );
    const lint = await fetch(f.url + "/api/declarations/lint", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: "portfolio.yml", text: source.text }),
    }).then((r) => r.json());
    expect(lint.preview).toEqual(source.preview);
    expect(isLintDeclarationResponse(lint)).toBe(true);
    expect(validate(lint), JSON.stringify(validate.errors)).toBe(true);
    const bad = await fetch(f.url + "/api/declarations/lint", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: "portfolio.yml",
        text: source.text.replace("guarantee: 30", "guarantee: 90"),
      }),
    }).then((r) => r.json());
    expect(bad.findings.length).toBeGreaterThan(0);
    expect(bad.preview).toBeUndefined();
    expect((await fetch(f.url + "/api/portfolio").then((r) => r.json())).items).toEqual(
      after.items,
    );
  } finally {
    await f.close();
  }
});

test("archive saves created choices and recovers before changed records are validated", async () => {
  const f = await archiveFixture();
  try {
    const db = f.service.store.connection.database;
    db.exec("INSERT INTO t3_environment VALUES ('local', 'server', 0, 0)");
    f.service.t3code.recordCreatedProject({
      environment: "local",
      projectId: "p1",
      actorId: "a1",
      item: "beta",
    });
    f.service.t3code.recordCreatedProject({
      environment: "local",
      projectId: "retired",
      actorId: "a1",
      item: "beta",
    });
    db.exec("UPDATE t3_created_project SET presence = 'removed' WHERE project_id = 'retired'");
    const read = await fetch(f.url + "/api/declarations/bindings").then((r) => r.json());
    expect(read.createdProjects).toEqual([
      { environment: "local", project: "p1", actorId: "a1", item: "beta" },
    ]);
    const post = (projects: unknown[], saveId = "5".repeat(32)) =>
      fetch(f.url + "/api/declarations/archive-item", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          item: "beta",
          projects,
          base: f.base,
          saveId,
          message: "Archive sample",
        }),
      });
    const projects = [
      { binding: "board-one", choice: "move" },
      { binding: "board-two", choice: "archive" },
      { created: { environment: "local", project: "p1" }, name: "chosen", choice: "move" },
    ];
    const response = await post(projects);
    expect(response.status).toBe(200);
    const saved = await response.json();
    expect(
      f.service.portfolio.usageItem(
        f.service.portfolio.t3codeProject({ environment: "local", id: "p1" }).item,
      ),
    ).toBe("alpha/other");
    f.service.t3code.recordCreatedProject({
      environment: "local",
      projectId: "p2",
      actorId: "a2",
      item: "beta",
    });
    db.exec("UPDATE t3_created_project SET presence = 'removed' WHERE project_id = 'p1'");
    expect(await (await post(projects)).json()).toMatchObject({
      outcome: "already-saved",
      commit: saved.commit,
    });
    const fresh = await post(projects, "6".repeat(32));
    expect(fresh.status).toBe(422);
    expect((await fresh.json()).findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "choice-missing" }),
        expect.objectContaining({ kind: "not-attached" }),
      ]),
    );
    expect(f.service.t3code.createdProject("local", "p1")).toMatchObject({
      item: "beta",
      actorId: "a1",
    });
  } finally {
    await f.close();
  }
});
