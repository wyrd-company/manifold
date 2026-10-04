// ---
// relationships:
//   verifies: process-manifest
// ---
import { describe, expect, it } from "vite-plus/test";
import { stringify, parse } from "yaml";
import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { lintProcessManifest, processManifestSchema, intakeDecisionModelSchema } from "./index.ts";
import { decisionModelSchema } from "./decision-model-schema.ts";
const expression = (value = '{"blueprint":"blueprints/parcel.yml"}') => ({
  nodes: [
    { id: "in", type: "inputNode" },
    {
      id: "calculate",
      type: "customNode",
      content: { kind: "jsonataExpression", config: { expression: value } },
    },
    { id: "out", type: "outputNode" },
  ],
  edges: [
    { id: "one", sourceId: "in", targetId: "calculate" },
    { id: "two", sourceId: "calculate", targetId: "out" },
  ],
});
const manifest = stringify({ intake: { decisionModel: "models/parcel.yml" } });
const lint = (files: Record<string, string>) => lintProcessManifest(async (path) => files[path]);
describe("process manifest", () => {
  it("embeds the specification schemas", () => {
    for (const [name, schema] of [
      ["process-manifest", processManifestSchema],
      ["intake-decision-model", intakeDecisionModelSchema],
    ] as const)
      expect(schema).toEqual(
        parse(readFileSync(`../../docs/specifications/${name}.schema.yml`, "utf8")),
      );
  });
  it("checks missing, syntax and schema before following models", async () => {
    expect(await lint({})).toMatchObject({
      ok: false,
      findings: [{ kind: "manifest-missing", file: "manifold.yml", location: "" }],
    });
    for (const text of ["[", "intake: {}\nintake: {}", "---\n{}\n---\n{}"])
      expect(await lint({ "manifold.yml": text })).toMatchObject({
        ok: false,
        findings: [{ kind: "syntax" }],
      });
    for (const data of [
      {},
      { intake: { decisionModel: "../outside.yml" } },
      { intake: { decisionModel: "models/x.yml" }, extra: true },
    ])
      expect(await lint({ "manifold.yml": stringify(data) })).toMatchObject({
        ok: false,
        findings: [{ kind: "schema" }],
      });
  });
  it("reaches nested models breadth first once and gives stable results", async () => {
    const model = {
      nodes: [
        { id: "in", type: "inputNode" },
        { id: "nested", type: "decisionNode", content: { key: "models/second.yml" } },
        { id: "out", type: "outputNode" },
      ],
      edges: [
        { id: "one", sourceId: "in", targetId: "nested" },
        { id: "two", sourceId: "nested", targetId: "out" },
      ],
    };
    const files = {
      "manifold.yml": manifest,
      "models/parcel.yml": stringify(model),
      "models/second.yml": stringify(expression()),
    };
    const paths: string[] = [];
    const result = await lintProcessManifest(async (path) => {
      paths.push(path);
      return files[path as keyof typeof files];
    });
    expect(result).toMatchObject({
      ok: true,
      models: { "models/parcel.yml": model, "models/second.yml": expression() },
    });
    expect(paths).toEqual(Object.keys(files));
    expect(await lint(files)).toEqual(result);
  });
  it.each(["../outside.yml", "/abs.yml", "a//b.yml", "models/x.json", 7])(
    "never reads invalid nested key %s",
    async (key) => {
      const paths: string[] = [];
      const result = await lintProcessManifest(async (path) => {
        paths.push(path);
        return path === "manifold.yml"
          ? manifest
          : stringify({
              nodes: [{ id: "nested", type: "decisionNode", content: { key } }],
              edges: [],
            });
      });
      expect(result).toMatchObject({
        ok: false,
        findings: expect.arrayContaining([
          {
            file: "models/parcel.yml",
            location: "/nodes/0/content/key",
            severity: "error",
            kind: "model-key-invalid",
            message: expect.any(String),
          },
        ]),
      });
      expect(paths).toEqual(["manifold.yml", "models/parcel.yml"]);
    },
  );
  it("reports missing models at their reference, and malformed models at root", async () => {
    expect(await lint({ "manifold.yml": manifest })).toMatchObject({
      findings: [
        { kind: "model-missing", location: "/intake/decisionModel", file: "manifold.yml" },
      ],
    });
    expect(await lint({ "manifold.yml": manifest, "models/parcel.yml": "[" })).toMatchObject({
      findings: [{ kind: "model-syntax", location: "" }],
    });
  });
  it("maps every finding to a resolving pointer, including ambiguous ids", async () => {
    const table = {
      id: "table",
      type: "customNode",
      content: {
        kind: "jsonataDecisionTable",
        config: {
          hitPolicy: "first",
          inputs: [{ id: "size", field: "(" }],
          outputs: [{ id: "quote", field: "quote" }],
          rules: [
            { _id: "same", size: "(", quote: "1" },
            { _id: "same", size: "true", quote: "2" },
          ],
        },
      },
    };
    const sw = {
      id: "switch",
      type: "customNode",
      content: {
        kind: "jsonataSwitch",
        config: {
          hitPolicy: "first",
          statements: [
            { id: "same", condition: "(" },
            { id: "same", condition: "true" },
          ],
        },
      },
    };
    const model = {
      nodes: [
        {
          id: "shared",
          type: "customNode",
          content: { kind: "jsonataExpression", config: { expression: "(" } },
        },
        { id: "shared", type: "inputNode" },
        table,
        sw,
      ],
      edges: [],
    };
    const result = await lint({ "manifold.yml": manifest, "models/parcel.yml": stringify(model) });
    const locations = result.findings.map((f) => f.location);
    expect(locations).toEqual(
      expect.arrayContaining([
        "/nodes/1",
        "/nodes",
        "/nodes/2/content/config/rules",
        "/nodes/2/content/config/rules/1",
        "/nodes/3/content/config/statements",
        "/nodes/2/content/config/inputs/0/field",
      ]),
    );
    const ajv = new Ajv2020({ strict: false });
    ajv.addSchema(decisionModelSchema);
    const validate = ajv.compile({ ...processManifestSchema, $ref: "#/$defs/finding" });
    for (const f of result.findings) {
      expect(validate(f), JSON.stringify(validate.errors)).toBe(true);
      let value: unknown = model;
      for (const part of f.location.split("/").slice(1))
        value = (value as Record<string, unknown>)[
          part.replaceAll("~1", "/").replaceAll("~0", "~")
        ];
      expect(value, f.location).not.toBeUndefined();
    }
  });
  it("keeps warnings successful and propagates read failures", async () => {
    const model = {
      nodes: [
        { id: "in", type: "inputNode" },
        {
          id: "switch",
          type: "customNode",
          content: {
            kind: "jsonataSwitch",
            config: { hitPolicy: "first", statements: [{ id: "large", condition: "7" }] },
          },
        },
        { id: "out", type: "outputNode" },
      ],
      edges: [],
    };
    expect(
      await lint({ "manifold.yml": manifest, "models/parcel.yml": stringify(model) }),
    ).toMatchObject({
      ok: true,
      findings: [{ severity: "warning", finding: { kind: "never-boolean" } }],
    });
    await expect(
      lintProcessManifest(async () => {
        throw new Error("read failed");
      }),
    ).rejects.toThrow("read failed");
  });
});
