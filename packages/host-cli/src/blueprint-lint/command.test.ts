// ---
// relationships:
//   verifies: [host-cli-blueprint-lint, token-lint]
// ---
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vite-plus/test";
import { stringify } from "yaml";
import { blueprintLintCommand } from "./command.ts";
it("prints bound warnings without failing and validates the option before reading files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "blueprint-lint-"));
  const log = vi.spyOn(console, "log").mockImplementation(() => {}),
    error = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const file = join(directory, "sample.yml");
    await writeFile(
      file,
      stringify({
        machine: {
          initial: "queued",
          states: {
            queued: {
              meta: { gate: { comparator: "comparators/order.ts", return: { state: "returned" } } },
              on: { token: "trap" },
            },
            trap: {},
            returned: {},
            done: { type: "final" },
          },
        },
        schemas: { input: true, output: true, context: true, events: {} },
      }),
    );
    expect(await blueprintLintCommand(["--configuration-bound", "1", file])).toBe(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining(" token-unknown "));
    expect(await blueprintLintCommand([file])).toBe(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining(" token-violation "));
    for (const value of ["0", "-1", "1.5", "", "Infinity", "2x"])
      expect(await blueprintLintCommand(["--configuration-bound", value, "missing.yml"])).toBe(2);
    expect(await blueprintLintCommand(["--configuration-bound"])).toBe(2);
    expect(error).not.toHaveBeenCalledWith(expect.stringContaining("ENOENT"));
  } finally {
    log.mockRestore();
    error.mockRestore();
    await rm(directory, { recursive: true, force: true });
  }
});

it("prints exactly the loader findings and warnings for every fixture with shipped names", async () => {
  const { fixtures } = await import("../../../shared/src/token-lint/test-fixtures/blueprints.ts");
  const { memoryRevision, manifoldImplementationNames } =
    await import("@wyrd-company/manifold-shared");
  const { createBlueprintLoader } = await import("../../../service/src/blueprint-loader/index.ts");
  const { serviceImplementations } = await import("../../../service/src/implementations.ts");
  const directory = await mkdtemp(join(tmpdir(), "blueprint-parity-"));
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    for (const [name, doc] of fixtures) {
      const file = join(directory, `${name}.yml`),
        text = stringify(doc);
      await writeFile(file, text);
      const commit = "a".repeat(40),
        path = "blueprints/sample.yml";
      const loader = createBlueprintLoader({
        implementations: serviceImplementations(),
        revisionAt: async () => memoryRevision(commit, { [path]: text }),
        onExpressionError: () => {},
      });
      const load = await loader.version({ commit, path });
      const findings =
        load.status === "invalid"
          ? load.findings
          : load.status === "loaded"
            ? load.blueprint.warnings
            : [];
      log.mockClear();
      expect(await blueprintLintCommand([file])).toBe(load.status === "invalid" ? 1 : 0);
      expect(log.mock.calls.map(([line]) => line)).toEqual(
        findings.map((row) => {
          const suffix =
            row.kind === "implementation-unknown"
              ? ` (${row.implementationKind} ${row.name})`
              : row.gate
                ? ` (gate ${row.gate})`
                : "";
          return `${file}:${row.location} ${row.kind} ${row.message.replaceAll(/\r?\n/g, " ")}${suffix}`;
        }),
      );
    }
    expect(manifoldImplementationNames.raises).toEqual(
      new Map(Object.entries(serviceImplementations().raises ?? {})),
    );
  } finally {
    log.mockRestore();
    await rm(directory, { recursive: true, force: true });
  }
});

it("lints invoked model sets only with a repository, including shared models and missing or invalid roots", async () => {
  const { mkdir } = await import("node:fs/promises");
  const directory = await mkdtemp(join(tmpdir(), "blueprint-model-lint-"));
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    const file = join(directory, "sample.yml");
    await writeFile(
      file,
      stringify({
        machine: {
          initial: "quote",
          states: {
            quote: {
              invoke: { src: "decision-models/quote.yml", onDone: "done", onError: "done" },
            },
            done: { type: "final" },
          },
        },
        schemas: { input: true, output: true, context: true, events: {} },
      }),
    );
    expect(await blueprintLintCommand([file])).toBe(0);
    expect(await blueprintLintCommand(["--repository", directory, file])).toBe(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("decision-model"));
    await mkdir(join(directory, "decision-models"));
    await mkdir(join(directory, "shared"));
    const model = {
      nodes: [
        { id: "in", type: "inputNode" },
        { id: "nested", type: "decisionNode", content: { key: "shared/rates.yml" } },
        { id: "out", type: "outputNode" },
      ],
      edges: [
        { id: "one", sourceId: "in", targetId: "nested" },
        { id: "two", sourceId: "nested", targetId: "out" },
      ],
    };
    await writeFile(join(directory, "decision-models/quote.yml"), stringify(model));
    expect(await blueprintLintCommand(["--repository", directory, file])).toBe(1);
    await writeFile(
      join(directory, "shared/rates.yml"),
      stringify({
        nodes: [
          { id: "in", type: "inputNode" },
          { id: "out", type: "outputNode" },
        ],
        edges: [{ id: "one", sourceId: "in", targetId: "out" }],
      }),
    );
    expect(await blueprintLintCommand(["--repository", directory, file])).toBe(0);
    await writeFile(join(directory, "shared/rates.yml"), "[");
    expect(await blueprintLintCommand(["--repository", directory, file])).toBe(1);
  } finally {
    log.mockRestore();
    await rm(directory, { recursive: true, force: true });
  }
});
