// ---
// relationships:
//   verifies: blueprint-loader
// ---
import { describe, expect, it, vi } from "vite-plus/test";
import { createActor, fromPromise } from "xstate";
import { stringify } from "yaml";
import { manifoldImplementationNames, memoryRevision } from "@wyrd-company/manifold-shared";
import type { ProcessRepositoryRevision } from "@wyrd-company/manifold-shared";
import type { ProcessRepository } from "../process-repository/index.ts";
import { serviceImplementations } from "../implementations.ts";
import { createBlueprintLoader } from "./index.ts";
import type { ImplementationRegistry, LoadedBlueprint } from "./index.ts";
import { escalationImplementations } from "../escalations/index.ts";
import { fixture as escalationFixture } from "../escalations/test-support.ts";

const first = "a".repeat(40),
  second = "b".repeat(40);
const registry = (): ImplementationRegistry => ({
  actors: { courier: fromPromise(async () => ({})) },
  actions: { mark: () => {} },
  guards: { ready: () => true },
  delays: { pause: 100 },
});
const document = (state = "sorting") => ({
  machine: {
    id: "parcel",
    initial: state,
    context: {},
    states: { [state]: { on: { scanned: "delivered" } }, delivered: { type: "final" } },
  },
  schemas: { input: true, output: true, context: { type: "object" }, events: {} },
});
function revision(commit: string, files: Record<string, string>): ProcessRepositoryRevision {
  const revision = memoryRevision(commit, files);
  return { ...revision, read: vi.fn(revision.read), list: vi.fn(revision.list) };
}
function fixture() {
  const files = (state: string) => ({
    "blueprints/z-delivery.yml": stringify(document(state)),
    "blueprints/nested/collection.yaml": stringify(document()),
    "blueprints/a-return.yml": stringify(document()),
    "blueprints/broken.yml": stringify({
      ...document(),
      machine: {
        ...document().machine,
        states: { sorting: { entry: "absent" }, delivered: { type: "final" } },
      },
    }),
    "blueprints/readme.md": "ignore",
  });
  const revisions = new Map([
    [first, revision(first, files("sorting"))],
    [second, revision(second, files("routing"))],
  ]);
  const repository: Pick<ProcessRepository, "revisionAt"> = {
    revisionAt: async (commit) => revisions.get(commit),
  };
  const loader = createBlueprintLoader({
    implementations: registry(),
    revisionAt: repository.revisionAt,
    onExpressionError: vi.fn(),
  });
  return { loader, revisions, repository };
}
async function loaded(
  loader: ReturnType<typeof createBlueprintLoader>,
  commit = first,
): Promise<LoadedBlueprint> {
  const result = await loader.version({ commit, path: "blueprints/z-delivery.yml" });
  expect(result.status).toBe("loaded");
  if (result.status !== "loaded") throw new Error("fixture failed");
  return result.blueprint;
}

describe("blueprint loader", () => {
  it("loads populated revisions with isolated failures and reuses each immutable version", async () => {
    const { loader, revisions } = fixture();
    const initial = await loader.loadRevision(revisions.get(first)!);
    expect([...initial.blueprints.keys()]).toEqual([
      "blueprints/a-return.yml",
      "blueprints/nested/collection.yaml",
      "blueprints/z-delivery.yml",
    ]);
    expect([...initial.failures]).toEqual([
      [
        "blueprints/broken.yml",
        [
          expect.objectContaining({
            path: "blueprints/broken.yml",
            kind: "implementation-unknown",
            location: "/machine/states/sorting/entry",
          }),
        ],
      ],
    ]);
    const again = await loader.loadRevision(revisions.get(first)!);
    expect(again.blueprints.get("blueprints/z-delivery.yml")).toBe(
      initial.blueprints.get("blueprints/z-delivery.yml"),
    );
    expect(revisions.get(first)!.read).toHaveBeenCalledTimes(12);
  });
  it("restores an old version after a push and after a service restart", async () => {
    const { loader, revisions, repository } = fixture();
    const old = await loaded(loader);
    const actor = createActor(old.machine).start();
    const snapshot = actor.getPersistedSnapshot();
    actor.stop();
    await loader.loadRevision(revisions.get(second)!);
    expect((await loaded(loader)).machine).toBe(old.machine);
    const restarted = createBlueprintLoader({
      implementations: registry(),
      revisionAt: repository.revisionAt,
      onExpressionError: () => {},
    });
    const restoredVersion = await loaded(restarted);
    expect(restoredVersion.checkRestore(snapshot)).toEqual({ ok: true });
    const restored = createActor(restoredVersion.machine, { snapshot }).start();
    restored.send({ type: "scanned" });
    expect(restored.getSnapshot().value).toBe("delivered");
    restored.stop();
    expect((await loaded(loader, second)).checkRestore(snapshot)).toEqual({
      ok: false,
      mismatches: [{ kind: "state-missing", statePath: "sorting" }],
    });
  });
  it("contains unreachable malformed schemas and never falls back to an older version", async () => {
    const { loader, revisions } = fixture();
    await loaded(loader);
    revisions.set(
      second,
      revision(second, {
        "blueprints/z-delivery.yml": stringify({
          ...document(),
          schemas: { ...document().schemas, context: { type: 17 } },
          machine: {
            ...document().machine,
            states: {
              ...document().machine.states,
              unreachable: { entry: { type: "expression.assign", params: { expression: "{}" } } },
            },
          },
        }),
        "blueprints/valid.yml": stringify(document()),
      }),
    );
    const result = await loader.loadRevision(revisions.get(second)!);
    expect([...result.blueprints.keys()]).toEqual(["blueprints/valid.yml"]);
    expect(result.failures.get("blueprints/z-delivery.yml")).toEqual([
      expect.objectContaining({ kind: "schema-invalid", location: "/schemas/context" }),
    ]);
    expect(
      (await loader.version({ commit: second, path: "blueprints/z-delivery.yml" })).status,
    ).toBe("invalid");
  });
  it("retries missing commits, missing files, and I/O failures and shares concurrent loads", async () => {
    const { loader, revisions } = fixture();
    const version = { commit: "c".repeat(40), path: "blueprints/z-delivery.yml" };
    expect(await loader.version(version)).toEqual({ status: "missing", reason: "commit" });
    const current = revision(version.commit, {});
    revisions.set(version.commit, current);
    expect(await loader.version(version)).toEqual({ status: "missing", reason: "file" });
    const good = revision(version.commit, { [version.path]: stringify(document()) });
    vi.mocked(good.read).mockRejectedValueOnce(new Error("read failed"));
    revisions.set(version.commit, good);
    await expect(loader.version(version)).rejects.toThrow("read failed");
    const [a, b] = await Promise.all([loader.version(version), loader.version(version)]);
    expect(a).toBe(b);
    expect(good.read).toHaveBeenCalledTimes(4);
  });
  it("rejects the reserved registry prefix in all kinds and ships matching names", async () => {
    for (const kind of ["actors", "actions", "guards", "delays"] as const) {
      const implementations = registry();
      const bad = {
        ...implementations,
        [kind]: { ...implementations[kind], "expression.custom": () => {} },
      } as ImplementationRegistry;
      expect(() =>
        createBlueprintLoader({
          implementations: bad,
          revisionAt: async () => undefined,
          onExpressionError: () => {},
        }),
      ).toThrow(/expression.custom/);
    }
    const fixture = escalationFixture();
    try {
      const implementations = serviceImplementations({
        escalations: escalationImplementations(fixture.module),
      });
      for (const kind of ["actors", "actions", "guards", "delays"] as const)
        for (const name of Object.keys(implementations[kind]))
          expect(manifoldImplementationNames[kind].has(name)).toBe(true);
    } finally {
      await fixture.close();
    }
  });
  it("checks incomplete compound and parallel values, history, child identity, and child implementation", async () => {
    const doc = document();
    doc.machine = {
      id: "parcel",
      initial: "sorting",
      context: {},
      states: {
        sorting: {
          type: "parallel",
          states: {
            left: { initial: "ready", states: { ready: {} } },
            right: { initial: "ready", states: { ready: {} } },
          },
          invoke: { id: "route", src: "courier" },
        },
        delivered: { type: "final" },
      },
    } as typeof doc.machine;
    const current = revision(first, { "blueprints/z-delivery.yml": stringify(doc) });
    const loader = createBlueprintLoader({
      implementations: registry(),
      revisionAt: async () => current,
      onExpressionError: () => {},
    });
    const blueprint = await loaded(loader);
    const actor = createActor(blueprint.machine).start();
    const snapshot = actor.getPersistedSnapshot();
    actor.stop();
    expect(blueprint.checkRestore(snapshot)).toEqual({ ok: true });
    const changed = {
      ...snapshot,
      value: { sorting: { left: {} } },
      historyValue: { missing: [{ id: "also-missing" }] },
      children: { ghost: { src: "courier", snapshot: {} }, route: { src: "absent", snapshot: {} } },
    };
    expect(blueprint.checkRestore(changed)).toEqual({
      ok: false,
      mismatches: [
        { kind: "state-incomplete", statePath: "sorting" },
        { kind: "state-incomplete", statePath: "sorting.left" },
        { kind: "history-missing", stateId: "also-missing" },
        { kind: "history-missing", stateId: "missing" },
        { kind: "child-missing", childId: "ghost" },
        { kind: "child-missing", childId: "route" },
        { kind: "implementation-missing", childId: "route", src: "absent" },
      ],
    });
    const matching = {
      ...snapshot,
      value: { sorting: { left: "ready", right: "ready" } },
      children: { route: { src: "courier", snapshot: {} } },
    };
    expect(blueprint.checkRestore(matching)).toEqual({ ok: true });
  });
});

it("binds supplied implementations and expression sites and attributes runtime errors to their version", async () => {
  const mark = vi.fn();
  const onExpressionError = vi.fn();
  const doc = {
    machine: {
      id: "parcel",
      initial: "sorting",
      context: { count: 0 },
      states: {
        sorting: {
          entry: "mark",
          on: {
            scanned: {
              target: "routing",
              guard: {
                type: "expression.guard",
                params: { expression: 'event.count >= 0 ? true : $error("invalid count")' },
              },
              actions: {
                type: "expression.assign",
                params: { expression: '{"count": event.count}' },
              },
            },
          },
        },
        routing: {
          invoke: {
            id: "route",
            src: "courier",
            input: { type: "expression.map", params: { expression: '{"count": context.count}' } },
            onDone: "delivered",
          },
        },
        delivered: {
          type: "final",
          output: { type: "expression.map", params: { expression: '{"count": context.count}' } },
        },
      },
    },
    schemas: {
      input: true,
      output: { type: "object" },
      context: {
        type: "object",
        properties: { count: { type: "integer", minimum: 0 } },
        required: ["count"],
      },
      events: {
        scanned: {
          type: "object",
          properties: { type: { const: "scanned" }, count: { type: "integer", minimum: 0 } },
          required: ["type", "count"],
        },
      },
      actors: { courier: { input: { type: "object" }, output: true } },
    },
  };
  const courier = vi.fn(async (input: unknown) => input);
  const current = revision(first, { "blueprints/z-delivery.yml": stringify(doc) });
  const loader = createBlueprintLoader({
    implementations: {
      ...registry(),
      actions: { mark },
      actors: { courier: fromPromise(({ input }) => courier(input)) },
    },
    revisionAt: async () => current,
    onExpressionError,
  });
  const blueprint = await loaded(loader);
  const actor = createActor(blueprint.machine).start();
  expect(mark).toHaveBeenCalledOnce();
  actor.send({ type: "scanned", count: -1 });
  expect(actor.getSnapshot().value).toBe("sorting");
  expect(onExpressionError).toHaveBeenCalledWith(
    expect.objectContaining({
      detail: expect.objectContaining({
        kind: "evaluation",
        location: "/states/sorting/on/scanned/guard",
      }),
    }),
    blueprint.version,
  );
  actor.send({ type: "scanned", count: 7 });
  await vi.waitFor(() => expect(actor.getSnapshot().status).toBe("done"));
  expect(courier).toHaveBeenCalledWith({ count: 7 });
  expect(actor.getSnapshot().output).toEqual({ count: 7 });
  actor.stop();
});

it("checks invoked child machines recursively with prefixed paths without changing the snapshot", async () => {
  const { loader: childLoader } = fixture();
  const child = await loaded(childLoader);
  const doc = {
    ...document(),
    machine: {
      ...document().machine,
      states: {
        sorting: { invoke: { id: "route", src: "courier" } },
        delivered: { type: "final" },
      },
    },
  };
  const current = revision(first, { "blueprints/z-delivery.yml": stringify(doc) });
  const loader = createBlueprintLoader({
    implementations: { ...registry(), actors: { courier: child.machine } },
    revisionAt: async () => current,
    onExpressionError: () => {},
  });
  const parent = await loaded(loader);
  const actor = createActor(parent.machine).start();
  const saved = actor.getPersistedSnapshot();
  actor.stop();
  expect(parent.checkRestore(saved)).toEqual({ ok: true });
  const snapshot = {
    ...saved,
    children: {
      route: {
        src: "courier",
        snapshot: {
          value: "absent",
          historyValue: { missing: [] },
          children: { ghost: { src: "absent" } },
        },
      },
    },
  };
  const before = structuredClone(snapshot);
  expect(parent.checkRestore(snapshot)).toEqual({
    ok: false,
    mismatches: [
      { kind: "state-missing", statePath: "route.absent" },
      { kind: "history-missing", stateId: "route.missing" },
      { kind: "child-missing", childId: "route.ghost" },
      { kind: "implementation-missing", childId: "route.ghost", src: "absent" },
    ],
  });
  expect(snapshot).toEqual(before);
});

it("omits files that disappear between list and read and propagates source failures", async () => {
  const current = revision(first, { "blueprints/z-delivery.yml": stringify(document()) });
  vi.mocked(current.list).mockResolvedValueOnce([
    "blueprints/vanished.yml",
    "blueprints/z-delivery.yml",
    "blueprints/z-delivery.yml",
  ]);
  const loader = createBlueprintLoader({
    implementations: registry(),
    revisionAt: async () => current,
    onExpressionError: () => {},
  });
  const result = await loader.loadRevision(current);
  expect([...result.blueprints.keys()]).toEqual(["blueprints/z-delivery.yml"]);
  expect(result.failures.size).toBe(0);
  vi.mocked(current.list).mockRejectedValueOnce(new Error("list failed"));
  await expect(loader.loadRevision(current)).rejects.toThrow("list failed");
  let tries = 0;
  const retry = createBlueprintLoader({
    implementations: registry(),
    revisionAt: async () => {
      if (tries++ === 0) throw new Error("open failed");
      return current;
    },
    onExpressionError: () => {},
  });
  await expect(retry.version({ commit: first, path: "blueprints/z-delivery.yml" })).rejects.toThrow(
    "open failed",
  );
  expect((await retry.version({ commit: first, path: "blueprints/z-delivery.yml" })).status).toBe(
    "loaded",
  );
});

it("treats inherited actor properties as missing implementations", async () => {
  const { loader } = fixture();
  const blueprint = await loaded(loader);
  const snapshot = {
    status: "active" as const,
    output: undefined,
    error: undefined,
    value: "sorting",
    children: { ghost: { src: "toString", snapshot: {} } },
  };
  expect(blueprint.checkRestore(snapshot)).toEqual({
    ok: false,
    mismatches: [
      { kind: "child-missing", childId: "ghost" },
      { kind: "implementation-missing", childId: "ghost", src: "toString" },
    ],
  });
});

it("reports inherited state names as missing rather than traversing a prototype", async () => {
  const { loader } = fixture();
  const blueprint = await loaded(loader);
  const snapshot = {
    status: "active" as const,
    output: undefined,
    error: undefined,
    value: "toString",
  };
  expect(blueprint.checkRestore(snapshot)).toEqual({
    ok: false,
    mismatches: [{ kind: "state-missing", statePath: "toString" }],
  });
});

it("rejects a persisted child whose invoke is declared only on an inactive state", async () => {
  const doc = {
    ...document(),
    machine: {
      ...document().machine,
      states: {
        sorting: { invoke: { id: "route", src: "courier" } },
        delivered: { type: "final" },
      },
    },
  };
  const current = revision(first, { "blueprints/z-delivery.yml": stringify(doc) });
  const loader = createBlueprintLoader({
    implementations: registry(),
    revisionAt: async () => current,
    onExpressionError: () => {},
  });
  const blueprint = await loaded(loader);
  const snapshot = {
    status: "done" as const,
    output: undefined,
    error: undefined,
    value: "delivered",
    children: { route: { src: "courier", snapshot: {} } },
  };
  expect(blueprint.checkRestore(snapshot)).toEqual({
    ok: false,
    mismatches: [{ kind: "child-missing", childId: "route" }],
  });
});

it("orders discovery by Unicode code point", async () => {
  const paths = ["blueprints/\u{10000}.yml", "blueprints/\uE000.yml"];
  const current = revision(
    first,
    Object.fromEntries(paths.map((path) => [path, stringify(document())])),
  );
  const loader = createBlueprintLoader({
    implementations: registry(),
    revisionAt: async () => current,
    onExpressionError: () => {},
  });
  expect([...(await loader.loadRevision(current)).blueprints.keys()]).toEqual(paths.toReversed());
});

it("reports root and state entries before blueprint actions", async () => {
  const entries: string[] = [];
  const loader = createBlueprintLoader({
    implementations: registry(),
    revisionAt: async () =>
      memoryRevision(first, { "blueprints/z-delivery.yml": stringify(document()) }),
    onExpressionError: () => {},
    onStateEntry: ({ statePath }) => entries.push(statePath),
  });
  const blueprint = await loaded(loader);
  const actor = createActor(blueprint.machine).start();
  expect(entries).toEqual(["", "sorting"]);
  actor.send({ type: "scanned" });
  expect(entries).toEqual(["", "sorting", "delivered"]);
  actor.stop();
});

it("binds child blueprints at the parent's commit and returns their output", async () => {
  const parent = document("waiting");
  parent.machine.states = {
    waiting: { invoke: { id: "delivery", src: "blueprints/child.yml", onDone: "delivered" } },
    delivered: { type: "final" },
  } as unknown as typeof parent.machine.states;
  const loader = createBlueprintLoader({
    implementations: registry(),
    onExpressionError: () => {},
    revisionAt: async () =>
      memoryRevision(first, {
        "blueprints/z-delivery.yml": stringify(parent),
        "blueprints/child.yml": stringify({
          ...document("delivered"),
          machine: {
            id: "child",
            initial: "delivered",
            states: { delivered: { type: "final", output: { delivered: true } } },
          },
        }),
      }),
  });
  const result = await loaded(loader);
  const actor = createActor(result.machine).start();
  expect(actor.getSnapshot().status).toBe("done");
  actor.stop();
});

it.each(["missing", "invalid", "schemas", "cycle"])(
  "delivers child %s errors to onError while leaving the parent loaded",
  async (reason) => {
    let failure: unknown;
    const implementations = registry();
    const parent = {
      ...document("waiting"),
      machine: {
        id: "parent",
        initial: "waiting",
        states: {
          waiting: {
            invoke: {
              id: "delivery",
              src: "blueprints/child.yml",
              onError: { target: "delivered", actions: "child-error" },
            },
          },
          delivered: { type: "final" },
        },
      },
      schemas: {
        ...document().schemas,
        ...(reason === "schemas"
          ? { actors: { "blueprints/child.yml": { input: false, output: true } } }
          : {}),
      },
    };
    const child =
      reason === "invalid"
        ? "machine: bad"
        : stringify(
            reason === "cycle"
              ? {
                  ...document("waiting"),
                  machine: {
                    id: "child",
                    initial: "waiting",
                    states: {
                      waiting: { invoke: { id: "back", src: "blueprints/z-delivery.yml" } },
                      delivered: { type: "final" },
                    },
                  },
                }
              : document("delivered"),
          );
    const loader = createBlueprintLoader({
      implementations: {
        ...implementations,
        actions: {
          ...implementations.actions,
          "child-error": ({ event }: { event: { error: unknown } }) => {
            failure = event.error;
          },
        },
      },
      onExpressionError: () => {},
      revisionAt: async () =>
        memoryRevision(first, {
          "blueprints/z-delivery.yml": stringify(parent),
          ...(reason === "missing" ? {} : { "blueprints/child.yml": child }),
        }),
    });
    const blueprint = await loaded(loader);
    const actor = createActor(blueprint.machine).start();
    await new Promise<void>((done) => setImmediate(done));
    expect(actor.getSnapshot().status).toBe("done");
    expect(failure).toMatchObject({
      type: "child-blueprint",
      path: "blueprints/child.yml",
      reason,
    });
    actor.stop();
  },
);

it("rejects child path registry names and duplicate module names", () => {
  expect(() =>
    createBlueprintLoader({
      implementations: {
        ...registry(),
        actors: { "blueprints/child.yml": fromPromise(async () => {}) },
      },
      revisionAt: async () => undefined,
      onExpressionError: () => {},
    }),
  ).toThrow("Reserved implementation name");
  expect(() => serviceImplementations({ first: registry(), second: registry() })).toThrow(
    "courier",
  );
  const part = registry();
  expect(serviceImplementations({ module: part })).toEqual({ ...part, actorKinds: {} });
});

it("matches raised-event declarations in the shipped registry", () => {
  expect(new Map(Object.entries(serviceImplementations().raises ?? {}))).toEqual(
    manifoldImplementationNames.raises,
  );
});

it("loads unknown token lint warnings at the configured bound and exposes runtime keys", async () => {
  const doc = {
    ...document(),
    machine: {
      id: "parcel",
      initial: "sorting",
      states: {
        sorting: {
          meta: { gate: { comparator: "comparators/order.ts", return: { state: "returned" } } },
          on: { token: "packing" },
        },
        packing: { on: { finish: "returned" } },
        returned: {},
        done: { type: "final" },
      },
    },
  };
  const source = memoryRevision(first, { "blueprints/sample.yml": stringify(doc) });
  const loader = createBlueprintLoader({
    implementations: registry(),
    revisionAt: async () => source,
    onExpressionError: vi.fn(),
    configurationBound: 1,
  });
  const load = await loader.version({ commit: first, path: "blueprints/sample.yml" });
  expect(load).toMatchObject({
    status: "loaded",
    blueprint: {
      warnings: [{ kind: "token-unknown" }],
      tokens: { gates: [{ verdict: "unknown" }] },
    },
  });
});

it("reserves the in guard and compiles it for runtime state reads", async () => {
  expect(() =>
    createBlueprintLoader({
      implementations: { ...registry(), guards: { in: () => true } },
      revisionAt: async () => undefined,
      onExpressionError: vi.fn(),
    }),
  ).toThrow("Reserved implementation name: in");
  const doc = document();
  doc.machine.states["sorting"] = {
    on: {
      scanned: { target: "delivered", guard: { type: "in", params: { states: ["sorting"] } } },
    },
  } as unknown as (typeof doc.machine.states)[string];
  const source = memoryRevision(first, { "blueprints/sample.yml": stringify(doc) });
  const loader = createBlueprintLoader({
    implementations: registry(),
    revisionAt: async () => source,
    onExpressionError: vi.fn(),
  });
  const load = await loader.version({ commit: first, path: "blueprints/sample.yml" });
  if (load.status !== "loaded") throw new Error(JSON.stringify(load));
  const actor = createActor(load.blueprint.machine).start();
  actor.send({ type: "scanned" });
  expect(actor.getSnapshot().status).toBe("done");
  actor.stop();
});

// The paired default-worker trace takes 5.61 s to lint and load all 24 fixtures.
it("shares every fixture verdict and finding with the pure lint", async () => {
  const { fixtures, names } =
    await import("../../../shared/src/token-lint/test-fixtures/blueprints.ts");
  const { lintBlueprint } = await import("@wyrd-company/manifold-shared");
  for (const [, doc] of fixtures) {
    const text = stringify(doc),
      path = "blueprints/sample.yml";
    const source = memoryRevision(first, { [path]: text });
    const implementations = {
      actors: { worker: fromPromise(async () => undefined) },
      guards: { allowed: () => true },
      actions: { signal: () => {} },
      delays: { wait: 1 },
      raises: { signal: ["break"] },
    };
    const loader = createBlueprintLoader({
      implementations,
      revisionAt: async () => source,
      onExpressionError: vi.fn(),
    });
    const pure = await lintBlueprint(path, text, names);
    const load = await loader.version({ commit: first, path });
    if (pure.ok) {
      if (load.status !== "loaded") throw new Error(JSON.stringify(load));
      expect(load.blueprint.tokens.gates).toEqual(pure.tokens.gates);
      expect(load.blueprint.warnings).toEqual(pure.warnings);
    } else expect(load).toEqual({ status: "invalid", findings: pure.findings });
  }
}, 15_000);

it("checks card move literals against the same immutable revision and skips invalid declarations", async () => {
  const path = "blueprints/parcel.yml";
  const doc = {
    schemas: {
      input: true,
      output: true,
      context: true,
      events: {},
      actors: { "github-card-move": { input: true, output: true } },
    },
    machine: {
      initial: "packing",
      states: {
        packing: {
          invoke: { src: "github-card-move", input: { status: "Packed" }, onDone: "done" },
        },
        done: { type: "final" },
      },
    },
  };
  const revisions = new Map(
    [first, second].map((commit, index) => [
      commit,
      memoryRevision(commit, {
        [path]: stringify(doc),
        "bindings.yml":
          "githubProjects: { parcels: { owner: sample, number: 1, environment: local, item: shipments } }",
        "task-metadata.yml": `projects: { parcels: { lifecycle: { field: Stage, options: [${index ? "Shipped" : "Packed"}] } } }`,
      }),
    ]),
  );
  const loader = createBlueprintLoader({
    implementations: {
      actors: { "github-card-move": fromPromise(async () => ({})) },
      actions: {},
      guards: {},
      delays: {},
    },
    revisionAt: async (commit) => revisions.get(commit),
    onExpressionError: () => {},
  });
  expect((await loader.version({ commit: first, path })).status).toBe("loaded");
  expect(await loader.version({ commit: second, path })).toMatchObject({
    status: "invalid",
    findings: [{ kind: "lifecycle-option", name: "Packed" }],
  });
  revisions.set(
    "c".repeat(40),
    memoryRevision("c".repeat(40), { [path]: stringify(doc), "task-metadata.yml": "projects: []" }),
  );
  expect((await loader.version({ commit: "c".repeat(40), path })).status).toBe("loaded");
});
