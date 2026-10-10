// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, it } from "vite-plus/test";
import { stringify } from "yaml";
import { blueprintGraph } from "@wyrd-company/manifold-shared/blueprint-graph";
import { layoutCanvas } from "./canvas-layout.ts";
import type { CanvasNode, CanvasEdge } from "./canvas-layout.ts";

function expectConnected(drawing: { nodes: CanvasNode[]; edges: CanvasEdge[] }) {
  const nodes = new Map(drawing.nodes.map((node) => [node.id, node]));
  function origin(node: CanvasNode): { x: number; y: number } {
    const parent = node.parentId ? origin(nodes.get(node.parentId)!) : { x: 0, y: 0 };
    return { x: parent.x + node.position.x, y: parent.y + node.position.y };
  }
  for (const edge of drawing.edges) {
    const points = edge.data?.points ?? [];
    for (const [id, point] of [
      [edge.source, points[0]],
      [edge.target, points.at(-1)],
    ] as const) {
      const node = nodes.get(id)!;
      const { x, y } = origin(node);
      const width = Number(node.style?.width),
        height = Number(node.style?.height);
      const within =
        point &&
        point.x >= x - 0.01 &&
        point.x <= x + width + 0.01 &&
        point.y >= y - 0.01 &&
        point.y <= y + height + 0.01;
      const boundary =
        point &&
        Math.min(
          Math.abs(point.x - x),
          Math.abs(point.x - x - width),
          Math.abs(point.y - y),
          Math.abs(point.y - y - height),
        ) < 0.01;
      expect(within && boundary, `${edge.id} must meet ${id}`).toBe(true);
    }
  }
}
const graph = blueprintGraph(
  stringify({
    schemas: { input: true, output: true, context: true, events: {} },
    machine: {
      id: "sample",
      initial: "work",
      states: {
        work: {
          initial: "first",
          states: {
            first: { on: { NEXT: "second" } },
            second: { on: { FINISH: "#sample.complete" } },
          },
        },
        concurrent: { type: "parallel", states: { left: {}, right: {} } },
        complete: { type: "final" },
      },
    },
  }),
)!;
it("lays out nested and parallel nodes with labels, initial markers, and no sibling overlap", async () => {
  const layout = await layoutCanvas(graph, undefined, (label) => label.length * 8);
  expect(layout.nodes.filter((node) => node.type === "initial")).toHaveLength(2);
  expect(layout.edges.some((edge) => edge.data?.points?.length)).toBe(true);
  expectConnected(layout);
  for (const node of layout.nodes)
    for (const other of layout.nodes) {
      if (node.id >= other.id || node.parentId !== other.parentId) continue;
      const a = node.position,
        b = other.position;
      expect(
        a.x + Number(node.style?.width) <= b.x ||
          b.x + Number(other.style?.width) <= a.x ||
          a.y + Number(node.style?.height) <= b.y ||
          b.y + Number(other.style?.height) <= a.y,
      ).toBe(true);
    }
});
it("pins relative positions, ignores stale entries, and places new siblings to the right", async () => {
  const layout = await layoutCanvas(
    graph,
    {
      states: {
        work: { x: 16, y: 24 },
        "work.first": { x: 24, y: 64 },
        removed: { x: 9999, y: 9999 },
      },
    },
    (label) => label.length * 8,
  );
  expect(layout.nodes.find((node) => node.id === "work")?.position).toEqual({ x: 16, y: 24 });
  expect(layout.nodes.find((node) => node.id === "work.second")!.position.x).toBeGreaterThan(224);
  expect(layout.nodes.some((node) => node.id === "removed")).toBe(false);
});
it("routes the bundled task blueprint with measured labels", async () => {
  const { readFileSync } = await import("node:fs");
  const text = readFileSync(
    new URL("../../../../../packages/service/bundle/blueprints/task.yml", import.meta.url),
    "utf8",
  );
  const graph = blueprintGraph(text)!;
  const drawing = await layoutCanvas(graph, undefined, (label) => label.length * 8);
  expectConnected(drawing);
  expect(drawing.nodes.filter((node) => node.type === "state")).toHaveLength(graph.states.length);
  expect(drawing.edges.filter((edge) => edge.data?.transition)).toHaveLength(
    graph.transitions.length,
  );
  for (const edge of drawing.edges.filter((edge) => edge.label))
    expect(edge.data?.labelPosition).toBeDefined();
});

it("keeps pinned initial markers inside their parent without moving stored children", async () => {
  const layout = await layoutCanvas(
    graph,
    { states: { "work.first": { x: 24, y: 48 } } },
    () => 40,
  );
  const marker = layout.nodes.find((node) => node.type === "initial" && node.parentId === "work")!;
  expect(marker.position.x).toBeGreaterThanOrEqual(0);
  expect(marker.position.y).toBeGreaterThanOrEqual(0);
  expect(layout.nodes.find((node) => node.id === "work.first")!.position).toEqual({ x: 24, y: 48 });
});
