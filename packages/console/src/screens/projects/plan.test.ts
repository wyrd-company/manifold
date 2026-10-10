// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { planGroups } from "./plan.ts";
const changes = [
  {
    id: "1",
    storage: "project-field" as const,
    action: "create" as const,
    target: { field: "Category", lifecycle: false },
    requiresRemoval: false,
    description: "Create Category",
    side: "github" as const,
    drift: false,
    properties: [],
    from: null,
    to: null,
  },
  {
    id: "2",
    storage: "project-field" as const,
    action: "remove" as const,
    target: { field: "Unused", lifecycle: false },
    requiresRemoval: true,
    description: "Remove Unused",
    side: "github" as const,
    drift: false,
    properties: [],
    from: null,
    to: null,
  },
];
test("removals are visible but do not count until the operator includes them", () => {
  expect(planGroups(changes, false)).toMatchObject({
    count: 1,
    removals: [],
    groups: [{ creates: 1, removes: 0, rows: [{ kept: false }, { kept: true }] }],
  });
  expect(planGroups(changes, true)).toMatchObject({
    count: 2,
    removals: [changes[1]],
    groups: [{ removes: 1 }],
  });
});

test("changes group by kind and scope so shared scopes retain their own counts", () => {
  const scope = {
    kind: "repository" as const,
    name: "sample/depot",
    bindings: ["sample", "other"],
  };
  const labels = {
    ...changes[0]!,
    id: "label",
    storage: "label" as const,
    scope,
    target: { lifecycle: false, option: "size: small" },
  };
  const second = { ...labels, id: "second", scope: { ...scope, name: "sample/warehouse" } };
  expect(
    planGroups([...changes, labels, second], false).groups.map((group) => [
      group.storage,
      group.scope?.name,
      group.creates,
    ]),
  ).toEqual([
    ["project-field", undefined, 1],
    ["label", "sample/depot", 1],
    ["label", "sample/warehouse", 1],
  ]);
});
