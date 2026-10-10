// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { boardLanes, readCollapsed, writeCollapsed } from "./lanes.ts";
const issue = {
  nodeId: "parcel",
  repository: "example/delivery",
  number: 1,
  state: "open" as const,
};
const task = { actorId: "task:parcel", issue, status: null, openEscalations: 0 };
test("groups unset and undeclared statuses before declared lanes and preserves task order", () => {
  expect(
    boardLanes({
      binding: "sample",
      owner: "example",
      number: 1,
      item: "deliveries",
      lifecycle: { field: "Stage", options: ["Ready", "Delivered"] },
      tasks: [
        task,
        { ...task, actorId: "task:other", status: "Unknown" },
        { ...task, actorId: "task:third", status: "Delivered" },
      ],
    }).map((lane) => [lane.name, lane.tasks.map((t) => t.actorId)]),
  ).toEqual([
    ["No status", ["task:parcel", "task:other"]],
    ["Ready", []],
    ["Delivered", ["task:third"]],
  ]);
});
test("collapsed lanes tolerate absent or invalid storage and persist independently per Project", () => {
  let raw: string | null = null;
  const storage = {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      raw = value;
    },
  };
  expect(readCollapsed(storage, "example/1")).toEqual([]);
  writeCollapsed(storage, "example/1", ["Ready"]);
  writeCollapsed(storage, "example/2", ["Delivered"]);
  expect(readCollapsed(storage, "example/1")).toEqual(["Ready"]);
  raw = '{"example/1":[3]}';
  expect(readCollapsed(storage, "example/1")).toEqual([]);
  raw = "invalid";
  expect(readCollapsed(storage, "example/1")).toEqual([]);
  expect(readCollapsed(undefined, "example/1")).toEqual([]);
});
