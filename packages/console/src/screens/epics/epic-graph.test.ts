// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { epicGraph, criticalPath, epicEmphasis, neighborhood } from "./epic-graph.ts";
import type { Epic } from "@wyrd-company/manifold-shared/epics-api";
const fixture = (states: string, edges: string[]): Epic => ({
  root: "root",
  issues: [
    {
      issue: { nodeId: "root", repository: "example/delivery", number: 1, state: "open" },
      placement: "root",
    },
    ...[...states].map((s, i) => ({
      issue: {
        nodeId: String(i),
        repository: "example/delivery",
        number: i + 2,
        state: s === "o" ? ("open" as const) : ("closed" as const),
      },
      placement: "tree" as const,
      parent: "root",
    })),
  ],
  dependencies: edges.map((e) => ({ blocking: e[0]!, blocked: e[1]! })),
});
test("critical paths compare open count, length, then API order; closed ends are omitted", () => {
  expect(criticalPath(epicGraph(fixture("oooooc", ["01", "12", "34", "45"]))).nodes).toEqual([
    "0",
    "1",
    "2",
  ]);
  expect(criticalPath(epicGraph(fixture("oooo", ["01", "23"]))).nodes).toEqual(["0", "1"]);
  expect(criticalPath(epicGraph(fixture("cooc", ["01", "12", "23"]))).nodes).toEqual(["1", "2"]);
  expect(criticalPath(epicGraph(fixture("cccc", ["01", "12"]))).nodes).toEqual([]);
  expect(criticalPath(epicGraph(fixture("ocoo", ["01", "12"])), "1").nodes).toEqual([
    "0",
    "1",
    "2",
  ]);
});
test("cycles are marked and excluded while neighborhoods retain them", () => {
  const graph = epicGraph(fixture("ooooo", ["01", "12", "20", "34"]));
  expect(graph.edges.filter((e) => e.cyclic).map((e) => e.id)).toEqual(["0->1", "1->2", "2->0"]);
  expect(criticalPath(graph).nodes).toEqual(["3", "4"]);
  expect([...neighborhood(graph, "0").nodes]).toEqual(["0", "1", "2"]);
  const emphasis = epicEmphasis(graph, {
    hovered: "0",
    selected: "3",
    criticalPath: false,
    fadeCompleted: true,
  });
  expect(emphasis.nodes.get("4")).toBe(0.3);
  expect([...emphasis.critical]).toEqual(["3->4"]);
});
test("completed fading and selection work independently of the global path switch", () => {
  const graph = epicGraph(fixture("coo", ["01", "12"]));
  expect(epicEmphasis(graph, { criticalPath: false, fadeCompleted: true }).nodes.get("0")).toBe(
    0.55,
  );
  expect(epicEmphasis(graph, { criticalPath: false, fadeCompleted: true }).edges.get("0->1")).toBe(
    0.25,
  );
  expect(
    epicEmphasis(graph, { selected: "0", criticalPath: false, fadeCompleted: true }).nodes.get("0"),
  ).toBe(1);
  expect(epicEmphasis(graph, { criticalPath: false, fadeCompleted: false }).nodes.get("0")).toBe(1);
});

test("cycles entered and left by acyclic chains cannot bridge a critical path", () => {
  const graph = epicGraph(fixture("ooooooo", ["01", "12", "23", "31", "34", "45", "56"]));
  expect(graph.edges.filter((e) => e.cyclic).map((e) => e.id)).toEqual(["1->2", "2->3", "3->1"]);
  expect(criticalPath(graph).nodes).toEqual(["3", "4", "5", "6"]);
  expect(criticalPath(graph, "2")).toEqual({ nodes: ["2"], edges: [], open: 1 });
});
test("root is drawn only when named by a dependency; an outside issue participates", () => {
  const epic = fixture("oo", ["01"]);
  expect(epicGraph(epic).nodes).toEqual(["0", "1"]);
  expect(
    epicGraph({ ...epic, dependencies: [{ blocking: "root", blocked: "0" }, ...epic.dependencies] })
      .nodes,
  ).toEqual(["root", "0", "1"]);
  const outside = {
    ...epic,
    issues: [
      ...epic.issues,
      {
        issue: {
          nodeId: "outside",
          repository: "example/delivery",
          number: 10,
          state: "open" as const,
        },
        placement: "outside" as const,
      },
    ],
    dependencies: [{ blocking: "outside", blocked: "0" }, ...epic.dependencies],
  };
  expect(criticalPath(epicGraph(outside)).nodes).toEqual(["outside", "0", "1"]);
});
test("equal open counts prefer fewer issues; isolated closed selections remain visible", () => {
  const graph = epicGraph(fixture("oco ooc".replaceAll(" ", ""), ["01", "12", "34"]));
  expect(criticalPath(graph).nodes).toEqual(["3", "4"]);
  expect(criticalPath(graph, "5")).toEqual({ nodes: ["5"], edges: [], open: 0 });
  expect(
    epicEmphasis(graph, { selected: "5", criticalPath: true, fadeCompleted: true }).nodes.get("5"),
  ).toBe(1);
  expect(
    epicEmphasis(graph, {
      selected: "absent",
      criticalPath: false,
      fadeCompleted: false,
    }).nodes.get("0"),
  ).toBe(1);
  const focused = epicEmphasis(graph, {
    hovered: "1",
    selected: "3",
    criticalPath: false,
    fadeCompleted: true,
  });
  expect(focused.edges.get("3->4")).toBe(0.1);
  expect([...focused.critical]).toEqual(["3->4"]);
});
