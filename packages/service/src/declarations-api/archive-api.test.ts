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
