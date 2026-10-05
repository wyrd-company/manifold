// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { layoutGraph } from "./graph-layout.ts";
test("nested parallel graph retains parents, paths and cross-level edges", async () => {
  const graph = {
    states: [
      {
        path: "outer",
        key: "outer",
        type: "parallel" as const,
        initial: true,
        invokes: [],
        gated: false,
        location: "/outer",
      },
      {
        path: "outer.first",
        key: "first",
        parent: "outer",
        type: "atomic" as const,
        initial: true,
        invokes: [],
        gated: false,
        location: "/outer/first",
      },
      {
        path: "done",
        key: "done",
        type: "final" as const,
        initial: false,
        invokes: [],
        gated: false,
        location: "/done",
      },
    ],
    transitions: [
      {
        source: "outer.first",
        target: "done",
        trigger: "event" as const,
        label: "GO",
        guarded: true,
        location: "/transition",
      },
    ],
  };
  const result = await layoutGraph(graph);
  expect(result.nodes.map((node) => node.id)).toEqual(["outer", "outer.first", "done"]);
  expect(result.nodes[1]?.parentId).toBe("outer");
  expect(result.edges[0]).toMatchObject({ source: "outer.first", target: "done", label: "◇ GO" });
  expect(result.nodes[0]?.style?.height).toBeGreaterThan(56);
});
