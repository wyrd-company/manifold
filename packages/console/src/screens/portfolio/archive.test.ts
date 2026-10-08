// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { attachedBindings, siblingTargets, archiveRequest } from "./archive.ts";
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
