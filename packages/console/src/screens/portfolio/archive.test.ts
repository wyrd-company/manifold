// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { attachedBindings, siblingTargets, archiveRequest, createdBindingName } from "./archive.ts";
import type { PortfolioResponse } from "@wyrd-company/manifold-shared/portfolio-api";
import type { BindingsResponse } from "@wyrd-company/manifold-shared/declarations-api";
const item = (id: string, parent: string | null = null, archived = false, other = false) => ({
  id,
  parent,
  archived,
  other,
  title: id,
  projects: { github: [], t3code: [] },
  allocations: [],
  activeTasks: 0,
  completedTasks: 1,
});
const read: PortfolioResponse = {
  commit: "a".repeat(40),
  at: new Date(0).toISOString(),
  pricing: { bundledCommit: "a".repeat(40), bundledModels: 0, overrides: 0, unpriced: [] },
  accounts: [],
  warnings: [],
  unallocated: [],
  items: [
    item("alpha"),
    item("beta", "alpha"),
    item("gamma", "alpha"),
    item("child", "beta"),
    item("archived", "alpha", true),
    item("alpha/other", "alpha", false, true),
    item("delta"),
  ],
};
const binding = (name: string, id: string, archived = false) => ({
  name,
  item: id,
  archived,
  environment: "local",
  owner: "sample",
  number: 1,
  t3codeProjects: [],
});
const bindings: BindingsResponse = {
  createdProjects: [],
  repository: { url: "https://example.test/repo.git", branch: "main" },
  commit: "a".repeat(40),
  findings: [],
  environments: [],
  items: read.items.filter((i) => !i.other && !i.archived),
  githubProjects: [
    binding("board-one", "child"),
    binding("archived-board", "beta", true),
    binding("other-board", "delta"),
  ],
  t3codeProjects: [],
};
test("archive lists descendant bindings and declared live siblings, and builds all choices", () => {
  expect(attachedBindings(read, bindings, "beta").map((b) => b.name)).toEqual(["board-one"]);
  expect(siblingTargets(read, bindings, "beta").map((i) => i.id)).toEqual(["gamma"]);
  expect(siblingTargets(read, bindings, "alpha").map((i) => i.id)).toEqual(["delta"]);
  expect(
    archiveRequest(
      "beta",
      attachedBindings(read, bindings, "beta"),
      { "board-one": { choice: "reassign", item: "gamma" } },
      bindings.commit,
      "b".repeat(32),
    ),
  ).toMatchObject({
    item: "beta",
    projects: [{ binding: "board-one", choice: "reassign", item: "gamma" }],
    message: "Archive portfolio item beta",
  });
  expect(
    archiveRequest(
      "beta",
      attachedBindings(read, bindings, "beta"),
      {},
      bindings.commit,
      "b".repeat(32),
    ),
  ).toBeUndefined();
});

test("created rows use unique bounded names and send identity choices", () => {
  expect(createdBindingName("Sample title", ["t3-sample-title"])).toBe("t3-sample-title-2");
  expect(createdBindingName("x".repeat(100), [])).length(64);
  const rows = attachedBindings(
    read,
    {
      ...bindings,
      createdProjects: [{ environment: "local", project: "p1", actorId: "a1", item: "beta" }],
    },
    "beta",
  );
  expect(rows.map((r) => r.name)).toEqual(["board-one", "t3-p1"]);
  expect(
    archiveRequest(
      "beta",
      rows,
      { "board-one": { choice: "move" }, [JSON.stringify(["local", "p1"])]: { choice: "archive" } },
      bindings.commit,
      "a".repeat(32),
    )?.projects,
  ).toContainEqual({
    created: { environment: "local", project: "p1" },
    name: "t3-p1",
    choice: "archive",
  });
});

test("created names stay with identities when a same-title project appears earlier", () => {
  const first = {
    ...bindings,
    githubProjects: [],
    createdProjects: [{ environment: "local", project: "p2", actorId: "a1", item: "beta" }],
    environments: [
      {
        name: "local",
        projects: [{ id: "p2", title: "Sample", workspaceRoot: "/sample", activeThreads: 0 }],
      },
    ],
  };
  const rows = attachedBindings(read, first, "beta");
  const retained = { [JSON.stringify(["local", "p2"])]: rows[0]!.name };
  const next = {
    ...first,
    createdProjects: [
      { environment: "local", project: "p1", actorId: "a1", item: "beta" },
      ...first.createdProjects,
    ],
    environments: [
      {
        name: "local",
        projects: [
          { id: "p1", title: "Sample", workspaceRoot: "/sample", activeThreads: 0 },
          ...first.environments[0]!.projects,
        ],
      },
    ],
  };
  expect(attachedBindings(read, next, "beta", retained).map((r) => r.name)).toEqual([
    "t3-sample-2",
    "t3-sample",
  ]);
});
