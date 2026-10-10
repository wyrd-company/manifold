// ---
// relationships:
//   verifies: [task-metadata, task-metadata-declaration]
// ---
import { expect, test } from "vite-plus/test";
import { lintTaskMetadataDeclaration, scopeOwnership } from "@wyrd-company/manifold-shared";
import { planScopeConfiguration } from "./scope-plan.ts";
import { acceptFields } from "./accept.ts";
import type { ScopeInput } from "./project-types.ts";
const text = `# retained
projects:
  parcels:
    repositories: [sample/*]
    lifecycle: { field: Stage, options: [Packed] }
    fields:
      size:
        type: single-select
        storage: { kind: label, prefix: 'size: ' }
        whenChanged: accept
        options: [{name: Small, color: aabbcc, description: Compact}]
      batch:
        type: single-select
        storage: { kind: milestone }
        options: [Spring]
  crates:
    repositories: [sample/depot]
    lifecycle: { field: Stage, options: [Packed] }
    fields:
      length:
        type: single-select
        storage: { kind: label, prefix: 'size: long: ' }
        options: [Large]
`;
function input(): ScopeInput {
  const lint = lintTaskMetadataDeclaration({
    taskMetadata: text,
    bindings:
      "githubProjects: { parcels: { owner: sample, number: 1, environment: local, item: shipments }, crates: { owner: sample, number: 2, environment: local, item: shipments } }",
  });
  if (!lint.ok) throw new Error(JSON.stringify(lint.findings));
  const owned = scopeOwnership(lint.declaration, {}, () => ["sample/depot"]).get(
    "repository:sample/depot",
  )!;
  return {
    scope: owned.scope,
    owned,
    bindings: owned.bindings,
    applied: undefined,
    observed: {
      scope: owned.scope,
      status: "ready",
      readAt: 1,
      issueFields: [],
      issueTypes: [],
      labels: [
        { nodeId: "L_one", name: "size: Small", color: "aabbcc", description: "Compact" },
        { nodeId: "L_two", name: "size: long: Large", color: "ededed", description: "" },
        { nodeId: "L_old", name: "SIZE: Old", color: "ededed", description: "" },
        { nodeId: "L_plain", name: "personal", color: "ededed", description: "" },
      ],
      milestones: [
        { nodeId: "M_one", number: 1, title: "Spring", description: "", state: "closed" },
        { nodeId: "M_other", number: 2, title: "Other", description: "", state: "open" },
      ],
    },
  };
}
test("repository union removes only undeclared labels under owned prefixes", () => {
  const planned = planScopeConfiguration(input());
  expect(planned.changes).toMatchObject([
    { storage: "label", action: "remove", requiresRemoval: true, target: { field: "SIZE: Old" } },
  ]);
  expect(planned.writes.map((g) => g.write)).toEqual([
    { kind: "label-delete", repository: "sample/depot", nodeId: "L_old" },
  ]);
});
test("repository label drift accepts a rename by identity into every declaring binding", () => {
  const base = input();
  if (base.observed?.status !== "ready") throw new Error("ready required");
  const applied = planScopeConfiguration(base).applied!;
  const observed = {
    ...base.observed,
    labels: base.observed.labels.map((l) =>
      l.nodeId === "L_one" ? { ...l, name: "size: Tiny", color: "ddeeff" } : l,
    ),
  };
  const scope = { ...base, observed, applied };
  const planned = planScopeConfiguration(scope);
  expect(planned.changes.find((c) => c.drift)).toMatchObject({
    side: "declaration",
    to: { name: "size: Tiny", color: "ddeeff" },
  });
  expect(planned.writes.some((g) => g.write.kind === "label-update")).toBe(false);
  const accepted = acceptFields(text, "parcels", planned.changes, {
    metadata: undefined,
    fields: [],
    applied: undefined,
    scopes: [scope],
  });
  expect(accepted).toContain("# retained");
  expect(accepted).toContain("name: Tiny");
  expect(accepted).toContain("color: ddeeff");
});
test("rename outside the label prefix reverts even when Accept is declared", () => {
  const base = input();
  if (base.observed?.status !== "ready") throw new Error("ready required");
  const applied = planScopeConfiguration(base).applied!;
  const observed = {
    ...base.observed,
    labels: base.observed.labels.map((l) =>
      l.nodeId === "L_one" ? { ...l, name: "other:Tiny" } : l,
    ),
  };
  expect(
    planScopeConfiguration({ ...base, observed, applied }).changes.find((c) => c.drift),
  ).toMatchObject({ side: "github", to: { name: "size: Small" } });
});
test("declared label rename retains applied identity and never deletes the renamed entity", () => {
  const base = input();
  const applied = planScopeConfiguration(base).applied!;
  const owned = {
    ...base.owned,
    entities: base.owned.entities.map((e) =>
      e.key === "label:size: small" ? { ...e, key: "label:size: tiny", name: "size: Tiny" } : e,
    ),
  };
  const planned = planScopeConfiguration({ ...base, owned, applied });
  expect(planned.writes.find((g) => g.write.kind === "label-update")?.write).toEqual({
    kind: "label-update",
    repository: "sample/depot",
    nodeId: "L_one",
    name: "size: Tiny",
  });
  expect(
    planned.writes.some((g) => g.write.kind === "label-delete" && g.write.nodeId === "L_one"),
  ).toBe(false);
});
test("milestone title drift accepts the option and leaves unrelated and closed milestones intact", () => {
  const base = input();
  if (base.observed?.status !== "ready") throw new Error("ready required");
  const owned = {
    ...base.owned,
    entities: base.owned.entities.map((e) =>
      e.storage === "milestone" ? { ...e, whenChanged: "accept" as const } : e,
    ),
  };
  const applied = planScopeConfiguration({ ...base, owned }).applied!;
  const observed = {
    ...base.observed,
    milestones: base.observed.milestones.map((m) =>
      m.nodeId === "M_one" ? { ...m, title: "Summer" } : m,
    ),
  };
  const scope = { ...base, owned, observed, applied };
  const planned = planScopeConfiguration(scope);
  expect(planned.changes.find((c) => c.storage === "milestone")).toMatchObject({
    side: "declaration",
    drift: true,
    to: { name: "Summer" },
  });
  const accepted = acceptFields(text, "parcels", planned.changes, {
    metadata: undefined,
    fields: [],
    applied: undefined,
    scopes: [scope],
  });
  expect(accepted).toContain("Summer");
  expect(accepted).not.toContain("Spring");
  expect(planned.writes.some((g) => g.write.kind === "milestone-update")).toBe(false);
});
test("shared label Accept updates all declaring fields and refuses a rename outside any declared prefix", () => {
  const base = input();
  if (base.observed?.status !== "ready") throw new Error("ready required");
  const owned = {
    ...base.owned,
    entities: base.owned.entities.map((e) =>
      e.key === "label:size: small"
        ? {
            ...e,
            declarations: [...e.declarations, { binding: "crates", field: "width" }],
            labelPrefixes: ["size: ", ""],
          }
        : e,
    ),
  };
  const sharedText =
    text +
    "      width: {type: single-select, storage: {kind: label, prefix: ''}, whenChanged: accept, options: ['size: Small']}\n";
  const applied = planScopeConfiguration({ ...base, owned }).applied!;
  const observed = {
    ...base.observed,
    labels: base.observed.labels.map((l) =>
      l.nodeId === "L_one" ? { ...l, name: "size: Tiny" } : l,
    ),
  };
  const scope = { ...base, owned, observed, applied };
  const planned = planScopeConfiguration(scope);
  const accepted = acceptFields(sharedText, "parcels", planned.changes, {
    metadata: undefined,
    fields: [],
    applied: undefined,
    scopes: [scope],
  });
  expect(accepted).toContain("name: Tiny");
  expect(accepted).toContain("size: Tiny");
  expect(accepted).not.toContain("size: Small");
});
test("a label added under an owned prefix after Apply is removal drift", () => {
  const base = input();
  if (base.observed?.status !== "ready") throw new Error("ready required");
  const applied = planScopeConfiguration(base).applied!;
  const observed = {
    ...base.observed,
    labels: [
      ...base.observed.labels,
      { nodeId: "L_new", name: "size: Extra", color: "ededed", description: "" },
    ],
  };
  const changes = planScopeConfiguration({ ...base, applied, observed }).changes;
  expect(changes.find((c) => c.target.field === "size: Extra")).toMatchObject({
    action: "remove",
    drift: true,
    requiresRemoval: true,
  });
  expect(changes.find((c) => c.target.field === "SIZE: Old")).toMatchObject({ drift: false });
});
test.each(["size: ", "size:  Tiny", "size: Tiny "])(
  "an unrepresentable label option %s reverts rather than saving invalid YAML",
  (name) => {
    const base = input();
    if (base.observed?.status !== "ready") throw new Error("ready required");
    const applied = planScopeConfiguration(base).applied!;
    const observed = {
      ...base.observed,
      labels: base.observed.labels.map((l) => (l.nodeId === "L_one" ? { ...l, name } : l)),
    };
    expect(
      planScopeConfiguration({ ...base, applied, observed }).changes.find((c) => c.drift),
    ).toMatchObject({ side: "github", to: { name: "size: Small" } });
  },
);
