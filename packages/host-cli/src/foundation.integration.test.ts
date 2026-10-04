// ---
// relationships:
//   verifies: [host-cli-comparator-lint, host-cli-expressions-lint, host-cli-blueprint-lint]
// ---
import { stringify } from "yaml";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

const blueprint = (guard: string) => `
machine:
  id: lamp
  initial: off
  context: { level: 0 }
  states:
    off:
      on:
        lamp.switch:
          guard: { type: expression.guard, params: { expression: '${guard}' } }
          actions: { type: expression.assign, params: { expression: '{"level": event.level}' } }
          target: on
    on: {}
schemas:
  context:
    type: object
    properties: { level: { type: number } }
    required: [level]
    additionalProperties: false
  events:
    lamp.switch:
      type: object
      properties: { type: { const: lamp.switch }, level: { type: number } }
      required: [type, level]
`;
const comparator =
  'import type { Comparator } from "manifold:comparator"; const pick: Comparator = input => input.population.length ? { task: input.population[0]!.id } : null; export default pick;';

describe("host CLI runs the comparator lint and the expressions lint", () => {
  let directory = "";
  const run = (...args: string[]) =>
    spawnSync(join(directory, "manifold-host"), args, { cwd: directory, encoding: "utf8" });
  beforeAll(() => {
    const cache = resolve("node_modules/.cache");
    mkdirSync(cache, { recursive: true });
    directory = mkdtempSync(join(cache, "foundation-binary-"));
    const build = spawnSync(
      "bun",
      [
        "build",
        "src/cli.ts",
        "--compile",
        "--bytecode",
        "--outfile",
        join(directory, "manifold-host"),
      ],
      { encoding: "utf8" },
    );
    expect(build.status, build.stderr).toBe(0);
    writeFileSync(join(directory, "pick.ts"), comparator);
    writeFileSync(join(directory, "late.ts"), "export default async () => null;");
    writeFileSync(join(directory, "valid.yml"), blueprint("event.level > context.level"));
    writeFileSync(join(directory, "counting.yml"), blueprint("event.level + 1"));
    writeFileSync(join(directory, "broken.yml"), blueprint("event.level >"));
    writeFileSync(
      join(directory, "full.yml"),
      blueprint("event.level > context.level")
        .replace("    on: {}", "    on: { type: final }")
        .replace("schemas:\n", "schemas:\n  input: true\n  output: true\n"),
    );
    writeFileSync(
      join(directory, "unknown.yml"),
      "machine: { initial: waiting, states: { waiting: { invoke: { src: unknown } }, done: { type: final } } }\nschemas: { input: true, output: true, context: true, events: {} }\n",
    );
    writeFileSync(join(directory, "invalid-yaml.yml"), "machine: [");
    writeFileSync(
      join(directory, "invalid-machine.yml"),
      "machine: { initial: waiting, states: { waiting: { on: { scanned: absent } }, done: { type: final } } }\nschemas: { input: true, output: true, context: true, events: {} }\n",
    );
    writeFileSync(
      join(directory, "full-counting.yml"),
      blueprint("event.level + 1")
        .replace("    on: {}", "    on: { type: final }")
        .replace("schemas:\n", "schemas:\n  input: true\n  output: true\n"),
    );
    writeFileSync(join(directory, "shapeless.yml"), "- just a list\n");
    const invalid = {
      context: "machine: {}\nschemas: { context: 42, events: {} }\n",
      event: blueprint("event.level > context.level").replace(
        /lamp\.switch:\n      type: object[\s\S]*$/,
        "lamp.switch: 42\n",
      ),
      actors: "machine: {}\nschemas: { events: {}, actors: { fetch: { output: 7 } } }\n",
      actorList: "machine: {}\nschemas: { events: {}, actors: [fetch] }\n",
    };
    for (const [name, text] of Object.entries(invalid))
      writeFileSync(join(directory, `invalid-${name}.yml`), text);
  }, 30_000);
  afterAll(() => rmSync(directory, { recursive: true, force: true }));

  it("reports token verdicts and bounds from the compiled binary", () => {
    const doc = {
      machine: {
        initial: "queued",
        states: {
          queued: {
            meta: { gate: { comparator: "comparators/order.ts", return: { state: "returned" } } },
            on: { token: "broken" },
          },
          broken: {},
          returned: {},
          done: { type: "final" },
        },
      },
      schemas: {
        input: true,
        output: true,
        context: true,
        events: {
          token: { type: "object", properties: { type: { const: "token" } }, required: ["type"] },
        },
      },
    };
    writeFileSync(join(directory, "token-violation.yml"), stringify(doc));
    const violation = run("blueprint", "lint", "token-violation.yml");
    expect(violation.status).toBe(1);
    expect(violation.stdout).toContain("token-violation");
    expect(violation.stdout).toContain("(gate queued)");
    const unknown = run("blueprint", "lint", "--configuration-bound", "1", "token-violation.yml");
    expect(unknown.status).toBe(0);
    expect(unknown.stdout).toContain("token-unknown");
    doc.machine.states.broken = { on: { finish: "done" } };
    writeFileSync(join(directory, "token-ending.yml"), stringify(doc));
    const ending = run("blueprint", "lint", "token-ending.yml");
    expect(ending.status).toBe(0);
    expect(ending.stdout).toContain("token-potential");
    expect(ending.stdout).toContain("only actor completion");
    doc.machine.states.broken = {};
    doc.machine.states.queued.on.token = {
      target: "broken",
      guard: { type: "expression.guard", params: { expression: "true" } },
    } as unknown as string;
    writeFileSync(join(directory, "token-potential.yml"), stringify(doc));
    const potential = run("blueprint", "lint", "token-potential.yml");
    expect(potential.status).toBe(0);
    expect(potential.stdout).toContain("token-potential");
    const invalid = run("blueprint", "lint", "--configuration-bound", "0", "token-violation.yml");
    expect([invalid.status, invalid.stdout]).toEqual([2, ""]);
  });

  it("lints comparators from the compiled binary", () => {
    const clean = run("comparator", "lint", "pick.ts");
    expect([clean.status, clean.stdout, clean.stderr]).toEqual([0, "", ""]);
    const late = run("comparator", "lint", "late.ts");
    expect(late.status).toBe(1);
    expect(late.stdout).toContain("late.ts:1:1 TS2322");
  });

  it("lints blueprint expressions from the compiled binary", () => {
    const clean = run("expressions", "lint", "valid.yml");
    expect([clean.status, clean.stdout, clean.stderr]).toEqual([0, "", ""]);
    const findings = run("expressions", "lint", "counting.yml", "broken.yml");
    expect(findings.status).toBe(1);
    const lines = findings.stdout.split("\n").filter(Boolean);
    expect(lines[0]).toMatch(/^counting\.yml:\/states\/off\/on\/lamp\.switch\/guard result /);
    expect(lines.at(-1)).toMatch(/^broken\.yml:\/states\/off\/on\/lamp\.switch\/guard syntax /);
    expect(lines.filter((line) => line.startsWith("broken.yml"))).toHaveLength(1);
  });

  it("lints full blueprints and preserves expression-only inputs from the compiled binary", () => {
    for (const [command, file] of [
      ["blueprint", "full.yml"],
      ["expressions", "full.yml"],
      ["expressions", "valid.yml"],
    ]) {
      const clean = run(command!, "lint", file!);
      expect([clean.status, clean.stdout, clean.stderr]).toEqual([0, "", ""]);
    }
    const result = run(
      "blueprint",
      "lint",
      "invalid-yaml.yml",
      "shapeless.yml",
      "unknown.yml",
      "invalid-machine.yml",
      "full-counting.yml",
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatch(/invalid-yaml.yml: yaml .* \(line 1, column \d+\)/);
    expect(result.stdout).toContain("shapeless.yml: shape ");
    expect(result.stdout).toContain(
      "unknown.yml:/machine/states/waiting/invoke/src implementation-unknown Implementation is not registered (actor unknown)",
    );
    expect(result.stdout).toContain("invalid-machine.yml:/machine/states/waiting machine ");
    expect(result.stdout).toContain(
      "full-counting.yml:/machine/states/off/on/lamp.switch/guard result ",
    );
    expect(run("blueprint", "lint").status).toBe(2);
    const missing = run("blueprint", "lint", "unknown.yml", "absent.yml");
    expect([missing.status, missing.stdout]).toEqual([2, ""]);
    expect(missing.stderr).toContain("absent.yml:");
  });

  it("refuses a missing or shapeless blueprint before linting any file", () => {
    expect(run("expressions", "lint").status).toBe(2);
    const shapeless = run("expressions", "lint", "valid.yml", "shapeless.yml");
    expect([shapeless.status, shapeless.stdout]).toEqual([2, ""]);
    expect(shapeless.stderr).toContain("shapeless.yml: expected a YAML mapping");
    for (const [name, reason] of [
      ["context", "`schemas.context` must be a JSON Schema"],
      ["event", "`schemas.events.lamp.switch` must be a JSON Schema"],
      ["actors", "`schemas.actors.fetch.output` must be a JSON Schema"],
      ["actorList", "`schemas.actors` must be a mapping"],
    ]) {
      const result = run("expressions", "lint", "counting.yml", `invalid-${name}.yml`);
      expect([result.status, result.stdout]).toEqual([2, ""]);
      expect(result.stderr).toContain(`invalid-${name}.yml: ${reason}`);
    }
    const missing = run("expressions", "lint", "counting.yml", "absent.yml");
    expect([missing.status, missing.stdout]).toEqual([2, ""]);
    expect(missing.stderr).toContain("absent.yml");
  });
});
