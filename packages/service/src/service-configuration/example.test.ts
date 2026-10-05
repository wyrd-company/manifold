// ---
// relationships:
//   verifies: [service-distribution, service-configuration]
// ---
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  serviceConfigurationSchemaId,
  serviceConfigurationSchemas,
} from "@wyrd-company/manifold-shared";
import { Ajv2020 } from "ajv/dist/2020.js";
import { isMap, isScalar, LineCounter, parseDocument, visit } from "yaml";
import { expect, test } from "vite-plus/test";
import { loadServiceConfiguration } from "./index.ts";

const example = new URL(
  "../../../../docs/specifications/service-configuration.example.yml",
  import.meta.url,
);
// REBASE STAND-IN: task 1156 owns this root property and its loader.
// Keep the example intact; validate the exact empty section before removing it
// only from the copy passed to today's loader.
const root = serviceConfigurationSchemas.find(
  (schema) => schema.$id === serviceConfigurationSchemaId,
)!;
const ajv = new Ajv2020({ allErrors: true });
for (const schema of serviceConfigurationSchemas) {
  ajv.addSchema(
    schema.$id === root.$id
      ? {
          ...root,
          properties: {
            ...root.properties,
            agentTools: { type: "object", additionalProperties: false },
          },
        }
      : schema,
  );
}
const validate = ajv.getSchema(serviceConfigurationSchemaId)!;
function check(text: string) {
  const lineCounter = new LineCounter();
  const document = parseDocument(text, { lineCounter });
  expect(document.errors).toEqual([]);
  expect(validate(document.toJS()), JSON.stringify(validate.errors)).toBe(true);
  expect(isMap(document.contents)).toBe(true);
  if (!isMap(document.contents)) throw new Error("Expected a configuration mapping");
  expect(document.contents.items.map((pair) => String(pair.key)).sort()).toEqual(
    [...Object.keys(root.properties), "agentTools"].sort(),
  );
  const lines = text.split("\n");
  visit(document, {
    Pair(_key, pair) {
      if (isScalar(pair.value)) {
        expect(
          Boolean(
            pair.value.comment ||
            (isScalar(pair.key) &&
              pair.key.range &&
              lines[lineCounter.linePos(pair.key.range[0]).line - 2]?.trim().startsWith("#")),
          ),
          `Missing comment for ${String(pair.key)}`,
        ).toBe(true);
      }
    },
  });
  return document;
}

test("the operator example loads with every credential file and every root section commented", async () => {
  const text = await readFile(example, "utf8");
  const document = check(text);
  const directory = await mkdtemp(join(tmpdir(), "operator-example-"));
  try {
    const paths: string[] = [];
    visit(document, {
      Pair(_key, pair) {
        if (
          ["privateKeyFile", "tokenFile", "secretFile"].includes(String(pair.key)) &&
          isScalar(pair.value)
        ) {
          // Collect placeholder paths only; no real credentials are read.
          paths.push(String(pair.value.value));
        }
      },
    });
    for (const path of paths) {
      await mkdir(dirname(join(directory, path)), { recursive: true });
      await writeFile(join(directory, path), "", { mode: 0o600 });
    }
    expect(document.toJS().agentTools).toEqual({});
    document.delete("agentTools");
    const file = join(directory, "service.yml");
    await writeFile(file, String(document));
    const loaded = await loadServiceConfiguration(file);
    expect([...loaded.credentials.names].sort()).toEqual([
      "github-app",
      "ntfy-token",
      "workstation-token",
    ]);
    expect(loaded.store.file).toBe(join(directory, "state/manifold.sqlite"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the example proof rejects a missing section, renamed value, and missing comment", async () => {
  const text = await readFile(example, "utf8");
  expect(() => check(text.replace("expressions: {}", ""))).toThrow();
  expect(() => check(text.replace("appId:", "applicationId:"))).toThrow();
  expect(() => check(text.replace("  # The port the service listens on.\n", ""))).toThrow(
    /Missing comment for port/,
  );
});
