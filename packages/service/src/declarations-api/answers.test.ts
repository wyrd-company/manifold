// ---
// relationships:
//   verifies: declarations-api
// ---
import { expect, test } from "vite-plus/test";
import { memoryRevision } from "@wyrd-company/manifold-shared";
import { lintAnswer, bindingsAnswer } from "./answers.ts";
import type { DeclarationsApiOptions } from "./index.ts";
const files = {
  "portfolio.yml": "items:\n  garden:\n    title: Garden\n  archive:\n    archived: true\n",
  "bindings.yml":
    "githubProjects:\n  garden:\n    owner: example\n    number: 1\n    environment: local\n    item: garden\n  unobserved:\n    owner: example\n    number: 2\n    environment: local\n    item: garden\nt3codeProjects:\n  workspace:\n    environment: local\n    project: workspace\n    item: garden\n",
  "task-metadata.yml":
    "projects:\n  garden:\n    lifecycle:\n      field: Stage\n      options: [Open, Done]\n    fields:\n      Notes:\n        type: text\n",
};
const revision = memoryRevision("a".repeat(40), files);
const options: DeclarationsApiOptions = {
  createdProjects: () => [],
  createDecisionModels: () => {
    throw new Error("Unexpected evaluation");
  },
  lintBlueprint: async () => {
    throw new Error("Unexpected blueprint lint");
  },
  revisions: {
    findSave: async () => undefined,
    latest: () => undefined,
    save: async () => {
      throw new Error("Unexpected save");
    },
  },
  processRepository: { revisionAt: async () => revision },
  repository: { url: "https://example.test/process", branch: "main" },
  environments: ["local", "unknown"],
  t3codeProjects: (name) =>
    name === "local"
      ? [{ id: "workspace", title: "Workspace", workspaceRoot: "/tmp/workspace", activeThreads: 2 }]
      : undefined,
  planDeclaration: () => [
    {
      binding: "garden",
      changes: [{ action: "create" }, { action: "change" }, { action: "remove" }],
      fields: [
        { lifecycle: true, github: "present", detail: "Matches" },
        { taskField: "Notes", lifecycle: false, github: "missing", detail: "Not created" },
      ],
    },
  ],
  log: () => {},
};
test("clean metadata gives counts and field observations without reading GitHub", async () => {
  const result = await lintAnswer(
    options,
    revision,
    "task-metadata.yml",
    files["task-metadata.yml"],
  );
  expect(result.findings).toEqual([]);
  expect(result.impact).toEqual([
    { binding: "garden", creates: 1, changes: 1, removes: 1 },
    { binding: "unobserved" },
  ]);
  expect(result.fields).toMatchObject([
    { name: "Stage", onGitHub: { state: "present" } },
    { name: "Notes", onGitHub: { state: "missing" } },
  ]);
});
test("portfolio lint retains cross-file findings and refuses archiving bound items", async () => {
  const lint = await lintAnswer(
    options,
    revision,
    "portfolio.yml",
    "items:\n  garden:\n    archived: true\n",
  );
  expect(lint.findings).toContainEqual(
    expect.objectContaining({ file: "bindings", kind: "archived-item" }),
  );
  const bindings = await lintAnswer(
    options,
    revision,
    "bindings.yml",
    "githubProjects:\n  garden:\n    owner: example\n    number: 1\n    environment: local\n    item: absent\n",
  );
  expect(bindings.findings).toMatchObject([{ kind: "unknown-item", range: expect.any(Object) }]);
  expect(bindings.findings[0]).not.toHaveProperty("file");
});
test("bindings lists available items and known environment projects", async () => {
  const result = await bindingsAnswer(options, revision);
  expect(result.findings).toEqual([]);
  expect(result.githubProjects).toHaveLength(2);
  expect(result.t3codeProjects).toHaveLength(1);
  expect(result.items).toEqual([{ id: "garden", title: "Garden" }]);
  expect(result.environments).toEqual([
    {
      name: "local",
      projects: [
        { id: "workspace", title: "Workspace", workspaceRoot: "/tmp/workspace", activeThreads: 2 },
      ],
    },
    { name: "unknown" },
  ]);
});
test("invalid portfolio does not hide valid bindings", async () => {
  const broken = memoryRevision("b".repeat(40), { ...files, "portfolio.yml": "items: [" });
  const result = await bindingsAnswer(options, broken);
  expect(result.findings).toEqual([]);
  expect(result.githubProjects).toHaveLength(2);
  expect(result.t3codeProjects).toHaveLength(1);
  expect(result.items).toEqual([]);
});
test("invalid portfolio does not hide clean task metadata impact", async () => {
  const broken = memoryRevision("b".repeat(40), {
    ...files,
    "portfolio.yml": "items: [",
    "bindings.yml": files["bindings.yml"].replace(
      "t3codeProjects:",
      "  archived:\n    owner: example\n    number: 3\n    environment: local\n    item: garden\n    archived: true\nt3codeProjects:",
    ),
  });
  const result = await lintAnswer(options, broken, "task-metadata.yml", files["task-metadata.yml"]);
  expect(result.findings).toEqual([]);
  expect(result.impact).toEqual([
    { binding: "garden", creates: 1, changes: 1, removes: 1 },
    { binding: "unobserved" },
  ]);
});
test("portfolio warnings point to undeclared accounts, even when bindings fail", async () => {
  const text = "items:\n  garden:\n    allocations:\n      missing:\n        guarantee: 20\n";
  const result = await lintAnswer(options, revision, "portfolio.yml", text);
  expect(result.warnings).toMatchObject([
    {
      kind: "account-undeclared",
      file: "portfolio",
      location: "/items/garden/allocations/missing",
      range: expect.any(Object),
    },
  ]);
  const invalidAccounts = memoryRevision("c".repeat(40), {
    ...files,
    "accounts.yml": "accounts: [",
  });
  expect((await lintAnswer(options, invalidAccounts, "portfolio.yml", text)).warnings).toEqual([]);
});
