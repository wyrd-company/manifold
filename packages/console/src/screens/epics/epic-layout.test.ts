// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { layoutEpic } from "./epic-layout.ts";
test("layout positions dependencies left to right with no node overlaps", async () => {
  const graph = {
    nodes: ["a", "b", "c", "d"],
    edges: [
      { id: "a->b", blocking: "a", blocked: "b", cyclic: false },
      { id: "a->c", blocking: "a", blocked: "c", cyclic: false },
      { id: "c->d", blocking: "c", blocked: "d", cyclic: false },
    ],
    open: () => true,
  };
  const layout = await layoutEpic(graph);
  for (const e of graph.edges)
    expect(layout.nodes.find((n) => n.id === e.blocked)!.position.x).toBeGreaterThan(
      layout.nodes.find((n) => n.id === e.blocking)!.position.x,
    );
  for (const a of layout.nodes)
    for (const b of layout.nodes)
      if (a.id !== b.id)
        expect(
          a.position.x + 152 <= b.position.x ||
            b.position.x + 152 <= a.position.x ||
            a.position.y + 84 <= b.position.y ||
            b.position.y + 84 <= a.position.y,
        ).toBe(true);
  expect(layout.edges.every((e) => e.points.length >= 2)).toBe(true);
});
