// ---
// relationships:
//   verifies: task-metadata
// ---
import { expect, test } from "vite-plus/test";
import { planProjectConfiguration } from "./index.ts";
const metadata = {
  lifecycle: { field: "Stage", options: ["Packed", "Sent"] },
  fields: {
    mass: {
      type: "number" as const,
      storage: { kind: "project-field" as const, name: "Mass" },
      whenChanged: "revert" as const,
    },
  },
};
const fields = [
  {
    nodeId: "F_stage",
    name: "Stage",
    type: "single-select" as const,
    options: [
      { id: "O_packed", name: "Packed", color: "gray" as const, description: "" },
      { id: "O_sent", name: "Sent", color: "blue" as const, description: "" },
    ],
  },
  { nodeId: "F_mass", name: "Mass", type: "number" as const, options: [] },
];
const applied = { fields, owned: { lifecycle: "F_stage", fields: { mass: "F_mass" } } };
test("empty Project plans fields; applied Project is in sync with a stable digest", () => {
  const empty = planProjectConfiguration({ metadata, fields: [], applied: undefined });
  expect(empty.configuration).toEqual({ state: "not-applied" });
  expect(empty.changes.map((c) => [c.action, c.target.field, c.drift])).toEqual([
    ["create", "Stage", false],
    ["create", "Mass", false],
  ]);
  const input = { metadata, fields, applied };
  expect(planProjectConfiguration(input).changes).toEqual([]);
  expect(planProjectConfiguration(input).configuration).toEqual({ state: "in-sync" });
  expect(planProjectConfiguration(input).digest).toMatch(/^[0-9a-f]{64}$/);
  expect(planProjectConfiguration(input)).toEqual(planProjectConfiguration(input));
});
test("renamed option is drift; declaration additions are pending; removals need permission", () => {
  const renamed = [
    {
      ...fields[0]!,
      options: [{ ...fields[0]!.options[0]!, name: "Ready" }, fields[0]!.options[1]!],
    },
    fields[1]!,
  ];
  const plan = planProjectConfiguration({ metadata, fields: renamed, applied });
  expect(plan.configuration).toEqual({ state: "drift", count: 1 });
  expect(plan.changes[0]).toMatchObject({
    action: "change",
    target: { option: "Packed" },
    properties: ["name"],
    drift: true,
  });
  const added = {
    ...metadata,
    lifecycle: { field: "Stage", options: ["Packed", "Sent", "Received"] },
  };
  expect(planProjectConfiguration({ metadata: added, fields, applied }).configuration).toEqual({
    state: "pending",
    count: 1,
  });
  const extra = [...fields, { nodeId: "F_note", name: "Note", type: "text" as const, options: [] }];
  expect(planProjectConfiguration({ metadata, fields: extra, applied }).changes[0]).toMatchObject({
    action: "remove",
    requiresRemoval: true,
    drift: true,
  });
  expect(
    planProjectConfiguration({ metadata, fields: extra, applied: { ...applied, fields: extra } })
      .configuration,
  ).toEqual({ state: "in-sync" });
});
test("accept is only planned for representable drift; lifecycle always reverts", () => {
  const accepting = {
    ...metadata,
    fields: { mass: { ...metadata.fields.mass, whenChanged: "accept" as const } },
  };
  const renamed = [fields[0]!, { ...fields[1]!, name: "Weight" }];
  expect(
    planProjectConfiguration({ metadata: accepting, fields: renamed, applied }).changes,
  ).toMatchObject([{ side: "declaration", action: "change", drift: true }]);
  const iteration = [fields[0]!, { ...fields[1]!, nodeId: "F_new", type: "iteration" as const }];
  const plan = planProjectConfiguration({ metadata: accepting, fields: iteration, applied });
  expect(plan.changes.map((c) => [c.side, c.action, c.requiresRemoval, c.drift])).toEqual([
    ["github", "remove", true, true],
    ["github", "create", true, true],
  ]);
});
test("field names remain unique on rename and replacement; option properties are owned only when declared", () => {
  const renamed = [
    { ...fields[0]!, name: "Old stage" },
    fields[1]!,
    { nodeId: "F_collision", name: "Stage", type: "text" as const, options: [] },
  ];
  const plan = planProjectConfiguration({ metadata, fields: renamed, applied });
  expect(plan.changes.map((c) => [c.action, c.target.field, c.requiresRemoval])).toEqual([
    ["remove", "Stage", true],
    ["change", "Stage", true],
  ]);
  const decorated = {
    ...metadata,
    lifecycle: metadata.lifecycle,
    fields: {
      choices: {
        type: "single-select" as const,
        storage: { kind: "project-field" as const, name: "Delivery" },
        whenChanged: "revert" as const,
        options: [{ name: "Air", color: "red" as const }, { name: "Road" }],
      },
    },
  };
  const observed = [
    ...fields,
    {
      nodeId: "F_delivery",
      name: "Delivery",
      type: "single-select" as const,
      options: [
        { id: "O_road", name: "Road", color: "blue" as const, description: "Keep" },
        { id: "O_air", name: "Air", color: "gray" as const, description: "Keep too" },
      ],
    },
  ];
  const prior = {
    fields: observed,
    owned: { lifecycle: "F_stage", fields: { choices: "F_delivery" } },
  };
  const result = planProjectConfiguration({
    metadata: decorated,
    fields: observed,
    applied: prior,
  });
  expect(
    result.changes.filter((c) => c.target.field === "Delivery").map((c) => c.properties),
  ).toEqual([["color"], ["order"]]);
  expect(result.changes.filter((c) => c.target.field === "Delivery").every((c) => !c.drift)).toBe(
    true,
  );
});
