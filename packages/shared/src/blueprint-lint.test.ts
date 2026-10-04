// ---
// relationships:
//   verifies: [blueprint, blueprint-loader]
// ---
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { parse, stringify } from "yaml";
import {
  lintBlueprint,
  blueprintVersionKey,
  parseBlueprintVersionKey,
  manifoldImplementationNames,
} from "./index.ts";
import { blueprintSchema, blueprintExpressionsSchema } from "./blueprint-schema.ts";

const names = {
  actors: new Set(["courier.route"]),
  actions: new Set(["mark"]),
  guards: new Set(["ready"]),
  delays: new Set(["pause"]),
};
const document = () => ({
  machine: {
    id: "delivery",
    initial: "sorting",
    context: {},
    states: { sorting: { on: { scanned: "delivered" } }, delivered: { type: "final" } },
  },
  schemas: {
    input: true,
    output: true,
    context: { type: "object" },
    events: {
      scanned: { type: "object", properties: { type: { const: "scanned" } }, required: ["type"] },
    },
  },
});
const lint = (value: unknown) => lintBlueprint("blueprints/delivery.yml", stringify(value), names);
async function findings(value: unknown) {
  const result = await lint(value);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.findings;
}

describe("blueprint lint", () => {
  it("keeps each boundary's local references independent when schema ids repeat", async () => {
    const value = document();
    const schema = (type: string) => ({
      $id: "https://example.invalid/schema",
      $defs: { value: { type } },
      $ref: "#/$defs/value",
    });
    const result = await lint({
      ...value,
      schemas: {
        ...value.schemas,
        input: schema("string"),
        output: schema("number"),
        context: schema("object"),
      },
    });
    expect(result.ok).toBe(true);
    const invalid = await findings({
      ...value,
      schemas: { ...value.schemas, input: schema("invalid"), output: schema("number") },
    });
    expect(invalid).toEqual([
      expect.objectContaining({ kind: "schema-invalid", location: "/schemas/input" }),
    ]);
  });

  it("accepts a clean document deterministically and keeps embedded schemas in agreement", async () => {
    expect(await lint(document())).toEqual({ ok: true, blueprint: document() });
    expect(await lint(document())).toEqual(await lint(document()));
    for (const [file, embedded] of [
      ["blueprint", blueprintSchema],
      ["blueprint-expressions", blueprintExpressionsSchema],
    ] as const)
      expect(embedded).toEqual(
        parse(
          readFileSync(
            new URL(`../../../docs/specifications/${file}.schema.yml`, import.meta.url),
            "utf8",
          ),
        ),
      );
    expect(manifoldImplementationNames.actors.size).toBe(0);
  });
  it("rejects invalid YAML with a position, duplicate keys, custom tags, multiple documents, and non-JSON values", async () => {
    for (const text of [
      "machine: [",
      "machine: {}\nmachine: {}",
      "machine: !custom {}",
      "---\na: 1\n---\nb: 2",
      "value: .inf",
      "value: &loop [*loop]",
    ]) {
      const result = await lintBlueprint("file", text, names);
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.findings[0]).toMatchObject({
          path: "file",
          kind: "yaml",
          location: "",
          line: expect.any(Number),
          column: expect.any(Number),
        });
    }
  });
  it("reports shape failures at their values and keys before later rules", async () => {
    expect(await findings({ machine: document().machine })).toContainEqual(
      expect.objectContaining({ kind: "shape", location: "/schemas" }),
    );
    const doc = document();
    doc.machine.states = { ...doc.machine.states, "bad.key": {} } as typeof doc.machine.states;
    expect(await findings(doc)).toContainEqual(
      expect.objectContaining({ kind: "shape", location: "/machine/states/bad.key" }),
    );
    for (const sorting of [
      { entry: "expression.assign" },
      { on: { scanned: { guard: "expression.guard" } } },
      { invoke: { src: "expression.map" } },
      { invoke: { src: "courier.route", input: { type: "expression.map" } } },
    ]) {
      expect(
        (
          await findings({
            ...document(),
            machine: { ...document().machine, states: { sorting, delivered: { type: "final" } } },
          })
        ).every((f) => f.kind === "shape"),
      ).toBe(true);
    }
  });
  it("preflights every schema, including one only used in an unreachable assignment", async () => {
    const doc = {
      ...document(),
      schemas: { ...document().schemas, context: { type: 17 } },
      machine: {
        ...document().machine,
        states: {
          ...document().machine.states,
          unreachable: { entry: { type: "expression.assign", params: { expression: "{}" } } },
        },
      },
    };
    expect(await findings(doc)).toEqual([
      expect.objectContaining({ kind: "schema-invalid", location: "/schemas/context" }),
    ]);
  });
  it("checks every implementation kind and sorts findings by rule and escaped location", async () => {
    const doc = {
      ...document(),
      machine: {
        ...document().machine,
        states: {
          sorting: {
            entry: "absent.action",
            on: {
              "scan/~": {
                target: "delivered",
                guard: "absent.guard",
                actions: "absent.transition",
              },
            },
            invoke: [{ src: "absent.actor", onError: { actions: "absent.error" } }],
            after: { "absent.delay": "delivered", "100": "delivered" },
          },
          delivered: { type: "final" },
        },
      },
    };
    const rows = await findings(doc);
    expect(
      rows
        .filter((f) => f.kind === "implementation-unknown")
        .map((f) => [f.location, f.implementationKind, f.name]),
    ).toEqual([
      ["/machine/states/sorting/after/absent.delay", "delay", "absent.delay"],
      ["/machine/states/sorting/entry", "action", "absent.action"],
      ["/machine/states/sorting/invoke/0/onError/actions", "action", "absent.error"],
      ["/machine/states/sorting/invoke/0/src", "actor", "absent.actor"],
      ["/machine/states/sorting/on/scan~1~0/actions", "action", "absent.transition"],
      ["/machine/states/sorting/on/scan~1~0/guard", "guard", "absent.guard"],
    ]);
  });
  it("resolves unreachable transitions, initial states, history defaults, and requires a top-level final", async () => {
    for (const extra of [
      { on: { scanned: "absent" } },
      { always: "absent" },
      { after: { "100": "absent" } },
      { invoke: { src: "courier.route", onDone: "absent" } },
    ]) {
      const rows = await findings({
        ...document(),
        machine: {
          ...document().machine,
          states: { ...document().machine.states, unreachable: extra },
        },
      });
      expect(rows).toContainEqual(
        expect.objectContaining({ kind: "machine", location: "/machine/states/unreachable" }),
      );
    }
    expect(
      await findings({ ...document(), machine: { ...document().machine, initial: "absent" } }),
    ).toContainEqual(expect.objectContaining({ kind: "machine", location: "/machine" }));
    expect(
      await findings({
        ...document(),
        machine: { ...document().machine, states: { sorting: {} } },
      }),
    ).toEqual([
      expect.objectContaining({ kind: "final-state-missing", location: "/machine/states" }),
    ]);
  });
  it("locates expression failures in the document and rejects wrong implementation kinds", async () => {
    const expression = (type: string, expression: string) => ({
      ...document(),
      machine: {
        ...document().machine,
        states: {
          sorting: {
            on: { scanned: { target: "delivered", guard: { type, params: { expression } } } },
          },
          delivered: { type: "final" },
        },
      },
    });
    expect(await findings(expression("expression.guard", "1"))).toContainEqual(
      expect.objectContaining({
        kind: "result",
        location: "/machine/states/sorting/on/scanned/guard",
      }),
    );
    expect(await findings(expression("expression.guard", "event."))).toContainEqual(
      expect.objectContaining({ kind: "syntax" }),
    );
    expect(await findings(expression("expression.assign", "{}"))).toContainEqual(
      expect.objectContaining({
        kind: "implementation-unknown",
        implementationKind: "guard",
        name: "expression.assign",
      }),
    );
  });
  it("lints the specified parcel example", async () => {
    const spec = parse(
      readFileSync(new URL("../../../docs/specifications/blueprint.yml", import.meta.url), "utf8"),
    );
    const text = spec.description.match(/```yaml\n([\s\S]*?)```/)[1];
    expect(await lintBlueprint("example.yml", text, names)).toMatchObject({ ok: true });
  });
});

it("round-trips version identity, including a colon in a path, and rejects malformed keys", () => {
  const version = { commit: "a".repeat(40), path: "blueprints/parcels/delivery:local.yaml" };
  expect(parseBlueprintVersionKey(blueprintVersionKey(version))).toEqual(version);
  for (const key of [
    ":blueprints/a.yml",
    "not-a-commit:blueprints/a.yml",
    `${version.commit}:other/a.yml`,
    `${version.commit}:blueprints/a.txt`,
  ])
    expect(parseBlueprintVersionKey(key)).toBeUndefined();
});

it("uses YAML 1.2 even when a document requests another version", async () => {
  const result = await lintBlueprint("file", `%YAML 1.1\n---\n${stringify(document())}`, names);
  expect(result).toMatchObject({
    ok: false,
    findings: [expect.objectContaining({ kind: "yaml", location: "" })],
  });
});

it("preflights all schema boundaries in location order", async () => {
  const invalid = { type: 17 };
  const rows = await findings({
    ...document(),
    machine: {
      ...document().machine,
      states: {
        sorting: {
          on: {
            scanned: {
              target: "delivered",
              guard: { type: "expression.guard", params: { expression: "true" } },
            },
          },
        },
        delivered: { type: "final" },
      },
    },
    schemas: {
      input: invalid,
      output: invalid,
      context: invalid,
      events: { "scan/~": invalid },
      actors: { courier: { input: invalid, output: invalid } },
    },
  });
  expect(rows.map((row) => [row.kind, row.location])).toEqual([
    ["schema-invalid", "/schemas/actors/courier/input"],
    ["schema-invalid", "/schemas/actors/courier/output"],
    ["schema-invalid", "/schemas/context"],
    ["schema-invalid", "/schemas/events/scan~1~0"],
    ["schema-invalid", "/schemas/input"],
    ["schema-invalid", "/schemas/output"],
  ]);
});

it("accepts supplied actor, action, guard, and delay references in every transition container", async () => {
  const transition = {
    target: "delivered",
    guard: { type: "ready", params: {} },
    actions: ["mark", { type: "mark", params: {} }],
  };
  const sorting = {
    entry: ["mark"],
    exit: "mark",
    on: { scanned: [transition] },
    always: transition,
    after: { pause: transition },
    onDone: transition,
    invoke: [
      { src: "courier.route", onDone: transition, onError: transition, onSnapshot: transition },
    ],
  };
  expect(
    await lint({
      ...document(),
      machine: { ...document().machine, states: { sorting, delivered: { type: "final" } } },
    }),
  ).toMatchObject({ ok: true });
});

it("resolves unreachable history defaults relative to their parent", async () => {
  const history = (target: string) => ({
    ...document(),
    machine: {
      ...document().machine,
      states: {
        ...document().machine.states,
        storage: {
          id: "custom.storage",
          initial: "ready",
          states: { ready: {}, previous: { type: "history", target } },
        },
      },
    },
  });
  expect(await findings(history("absent"))).toContainEqual(
    expect.objectContaining({
      kind: "machine",
      location: "/machine/states/storage/states/previous",
    }),
  );
  expect(await lint(history("ready"))).toMatchObject({ ok: true });
  expect(await lint(history("#delivery.delivered"))).toMatchObject({ ok: true });
});
