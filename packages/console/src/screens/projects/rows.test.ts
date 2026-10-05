// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { projectRows, t3codeRows } from "./rows.ts";
import type { BindingsResponse } from "@wyrd-company/manifold-shared/declarations-api";
const bindings: BindingsResponse = {
  repository: { url: "https://example.test/process", branch: "main" },
  commit: "a".repeat(40),
  findings: [],
  githubProjects: [
    {
      name: "sample",
      owner: "example",
      number: 1,
      environment: "east",
      item: "delivery",
      t3codeProjects: ["missing"],
      archived: false,
    },
  ],
  t3codeProjects: [
    { name: "workspace", environment: "west", item: "delivery", project: "work", archived: false },
    { name: "old", environment: "west", item: "delivery", project: "old", archived: true },
  ],
  items: [{ id: "delivery", title: "Delivery" }],
  environments: [{ name: "east", projects: [] }, { name: "west" }],
};
test("Project counts distinguish unavailable tasks from a read of an empty Project", () => {
  const projects = [
    {
      binding: "sample",
      owner: "example",
      number: 1,
      projectNodeId: null,
      portfolioItem: "delivery",
      environment: "east",
      configuration: { state: "not-applied" as const },
      lastApplied: null,
      observedAt: null,
    },
  ];
  expect(projectRows(projects, undefined, bindings)[0]).toMatchObject({
    itemTitle: "Delivery",
    active: undefined,
    completed: undefined,
  });
  expect(
    projectRows(
      projects,
      [{ binding: "sample", owner: "example", number: 1, item: "delivery", tasks: [] }],
      bindings,
    )[0],
  ).toMatchObject({ active: 0, completed: 0 });
});
test("T3code rows exclude archived bindings and distinguish an unknown environment from a missing project", () => {
  expect(t3codeRows(bindings)).toMatchObject([
    { id: "missing", associated: "example/1", missing: true },
    { id: "work", associated: undefined, missing: false, activeThreads: undefined },
  ]);
});
