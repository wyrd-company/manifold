// ---
// relationships:
//   verifies: task-metadata
// ---
import { expect, test } from "vite-plus/test";
import { planProjectConfiguration } from "./plan.ts";
import { planScopeConfiguration } from "./scope-plan.ts";
import type { ScopeInput } from "./project-types.ts";
function input(): { -readonly [K in keyof ScopeInput]: ScopeInput[K] } {
  const scope = { kind: "organization" as const, organization: "example" };
  const configuration = {
    scope,
    status: "ready" as const,
    readAt: 1,
    issueTypes: [],
    labels: [],
    milestones: [],
    issueFields: [
      {
        nodeId: "F_one",
        name: "Urgency",
        type: "single-select" as const,
        options: [
          { id: "O_one", name: "Normal", color: "blue" as const, description: "retained" },
          { id: "O_extra", name: "Extra", color: "gray" as const, description: "" },
        ],
      },
    ],
  };
  return {
    scope,
    bindings: ["first", "second"],
    owned: {
      scope,
      bindings: ["first", "second"],
      prefixes: [],
      entities: [
        {
          key: "issue-field:Urgency",
          name: "Urgency",
          storage: "issue-field",
          type: "single-select",
          options: [{ name: "Normal" }],
          whenChanged: "revert",
          declarations: [
            { binding: "first", field: "priority" },
            { binding: "second", field: "priority" },
          ],
        },
      ],
    },
    observed: configuration,
    applied: { configuration, owned: { "issue-field:Urgency": "F_one" } },
  };
}
test("issue field options preserve ids and unowned properties; removal requires explicit Apply", () => {
  const f = input();
  expect(planScopeConfiguration(f).changes).toMatchObject([
    { action: "remove", requiresRemoval: true, target: { option: "Extra" } },
  ]);
  expect(planScopeConfiguration(f, false).writes).toEqual([]);
  expect(planScopeConfiguration(f, true).writes[0]?.write).toEqual({
    kind: "issue-field-update",
    organization: "example",
    nodeId: "F_one",
    options: [{ id: "O_one", name: "Normal", color: "blue", description: "retained" }],
  });
});
test("organization field type replacement needs removal consent on both writes", () => {
  const f: { -readonly [K in keyof ScopeInput]: ScopeInput[K] } = input();
  f.owned = {
    ...f.owned,
    entities: f.owned.entities.map((e) => ({ ...e, type: "number", options: [] })),
  };
  expect(planScopeConfiguration(f).changes).toMatchObject([
    { action: "remove", requiresRemoval: true },
    { action: "create", requiresRemoval: true },
  ]);
  expect(planScopeConfiguration(f, false).writes).toEqual([]);
  expect(planScopeConfiguration(f, true).writes.map((g) => g.write.kind)).toEqual([
    "issue-field-delete",
    "issue-field-create",
  ]);
});
test("Accept turns organization field drift into a declaration change shared by both bindings", () => {
  const f: { -readonly [K in keyof ScopeInput]: ScopeInput[K] } = input();
  f.owned = {
    ...f.owned,
    entities: f.owned.entities.map((e) => ({ ...e, whenChanged: "accept" })),
  };
  if (f.observed?.status !== "ready") throw new Error("fixture");
  f.observed = {
    ...f.observed,
    issueFields: f.observed.issueFields.map((field) => ({ ...field, name: "Importance" })),
  };
  expect(planScopeConfiguration(f).changes).toMatchObject([
    {
      side: "declaration",
      drift: true,
      scope: { bindings: ["first", "second"] },
      to: { name: "Importance" },
    },
  ]);
  expect(planScopeConfiguration(f).writes).toEqual([]);
});

test("a shared organization change marks every owner's field alias as differing", () => {
  const scope = input();
  scope.owned = {
    ...scope.owned,
    entities: scope.owned.entities.map((e) => ({
      ...e,
      declarations: [
        { binding: "first", field: "priority" },
        { binding: "second", field: "urgency" },
      ],
    })),
  };
  const plan = planProjectConfiguration({
    metadata: {
      lifecycle: { field: "Stage", options: ["Sorting"] },
      fields: {
        urgency: {
          type: "single-select",
          whenChanged: "revert",
          storage: { kind: "issue-field", organization: "example", name: "Urgency" },
          options: [{ name: "Normal" }],
        },
      },
    },
    fields: [],
    applied: undefined,
    scopes: [scope],
  });
  expect(plan.fields.find((f) => f.taskField === "urgency")).toMatchObject({ github: "differs" });
});

test("an unowned issue type property cannot turn a declaration edit into Accept drift", () => {
  const f = input();
  if (f.observed?.status !== "ready") throw Error("fixture");
  const before = {
    ...f.observed,
    issueTypes: [
      {
        nodeId: "T_one",
        name: "Request",
        color: "blue" as const,
        description: "Original",
        enabled: true,
      },
    ],
  };
  f.applied = { configuration: before, owned: { "issue-type:request": "T_one" } };
  f.observed = {
    ...before,
    issueTypes: before.issueTypes.map((t) => ({ ...t, color: "green" as const })),
  };
  f.owned = {
    ...f.owned,
    entities: [
      {
        key: "issue-type:request",
        storage: "issue-type",
        name: "Request",
        description: "Declared edit",
        whenChanged: "accept",
        declarations: [{ binding: "first", field: "category" }],
      },
    ],
  };
  expect(planScopeConfiguration(f).changes).toMatchObject([
    { side: "github", drift: false, properties: ["description"] },
  ]);
});

test("disabled issue type drift stays Revert when Accept cannot represent it", () => {
  const f = input();
  if (f.observed?.status !== "ready") throw Error("fixture");
  const before = {
    ...f.observed,
    issueTypes: [
      { nodeId: "T_one", name: "Request", color: "blue" as const, description: "", enabled: true },
    ],
  };
  f.applied = { configuration: before, owned: { "issue-type:request": "T_one" } };
  f.observed = { ...before, issueTypes: before.issueTypes.map((t) => ({ ...t, enabled: false })) };
  f.owned = {
    ...f.owned,
    entities: [
      {
        key: "issue-type:request",
        storage: "issue-type",
        name: "Request",
        whenChanged: "accept",
        declarations: [{ binding: "first", field: "category" }],
      },
    ],
  };
  expect(planScopeConfiguration(f).changes).toMatchObject([
    { side: "github", drift: true, properties: ["enabled"] },
  ]);
  expect(planScopeConfiguration(f).writes[0]?.write).toMatchObject({
    kind: "issue-type-update",
    nodeId: "T_one",
    enabled: true,
  });
});
