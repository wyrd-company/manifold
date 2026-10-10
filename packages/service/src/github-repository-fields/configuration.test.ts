// ---
// relationships:
//   verifies: [task-metadata, projects-api, github-event-source]
// ---
import { expect, test } from "vite-plus/test";
import { repositoryConsole } from "./test-fixtures/console.ts";
test("repository Apply reads actual adapters, converges, reports outside tasks, and refuses whole Apply before writes", async () => {
  const h = await repositoryConsole();
  try {
    const plan = await h.plan("delivery");
    expect(plan.scopes).toMatchObject([{ scope: { name: "sample/depot" }, status: "ready" }]);
    expect(plan.outside).toEqual([{ repository: "elsewhere/outside", issues: 1 }]);
    await h.configuration.projects.apply("delivery", { removeUndeclared: true });
    expect((await h.plan("delivery")).configuration).toEqual({ state: "in-sync" });
    expect(
      (await h.configuration.projects.apply("delivery", { removeUndeclared: true })).writes,
    ).toBe(0);
    h.platform.deny(403);
    await expect(
      h.configuration.projects.apply("delivery", { removeUndeclared: true }),
    ).rejects.toMatchObject({ kind: "scope-unavailable", status: 409 });
  } finally {
    await h.close();
  }
});
test("label prefix removals require explicit Apply permission and never remove unrelated labels or milestones", async () => {
  const h = await repositoryConsole();
  try {
    await h.configuration.projects.apply("delivery", { removeUndeclared: true });
    await h.platform.adapters.writeScopeEntity({
      kind: "label-create",
      repository: "sample/depot",
      name: "size: Old",
      color: "eeeeee",
      description: "",
    });
    const plan = await h.plan("delivery");
    expect(plan.changes).toMatchObject([{ action: "remove", requiresRemoval: true }]);
    expect(
      (await h.configuration.projects.apply("delivery", { removeUndeclared: false })).changes,
    ).toMatchObject([{ outcome: "kept" }]);
    expect(h.platform.labels().some((l) => l.name === "size: Old")).toBe(true);
    await h.configuration.projects.apply("delivery", { removeUndeclared: true });
    expect(h.platform.labels().map((l) => l.name)).toEqual([
      "size: Small",
      "size: Large",
      "personal",
    ]);
  } finally {
    await h.close();
  }
});
test("external rename Accept saves the declaration; Revert renames the same GitHub entity", async () => {
  const h = await repositoryConsole();
  try {
    await h.configuration.projects.apply("delivery", { removeUndeclared: true });
    await h.platform.adapters.writeScopeEntity({
      kind: "label-update",
      repository: "sample/depot",
      nodeId: "L_small",
      name: "size: Tiny",
      color: "ddeeff",
    });
    const plan = await h.plan("delivery");
    expect(plan.changes).toMatchObject([{ side: "declaration", drift: true }]);
    const response = await fetch(h.url + "/api/projects/delivery/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeUndeclared: false, digest: plan.digest }),
    });
    expect(response.status).toBe(200);
    const current = await h.service.processRepository.current()!.read("task-metadata.yml");
    expect(current).toContain("name: Tiny");
    expect(current).toContain("color: ddeeff");
    expect(current).toContain("# retain");
    expect((await h.plan("delivery")).configuration).toEqual({ state: "in-sync" });
    await h.changeTaskMetadata(current!.replace("whenChanged: accept", "whenChanged: revert"));
    await h.service.revisions.pull();
    await h.configuration.apply(h.service.processRepository.current()!);
    await h.platform.adapters.writeScopeEntity({
      kind: "label-update",
      repository: "sample/depot",
      nodeId: "L_small",
      name: "size: Small",
      color: "aabbcc",
    });
    await h.configuration.projects.apply("delivery", { removeUndeclared: true });
    expect(h.platform.labels()[0]).toMatchObject({
      node_id: "L_small",
      name: "size: Tiny",
      color: "ddeeff",
    });
  } finally {
    await h.close();
  }
});
test("wildcards discover only Project issue repositories and a new repository stays pending until Apply", async () => {
  const h = await repositoryConsole();
  try {
    await h.configuration.projects.apply("delivery", { removeUndeclared: true });
    h.platform.addRepository("sample/warehouse");
    h.issues.push({
      ...h.issues[0]!,
      issue: { ...h.issues[0]!.issue, nodeId: "I_new", repository: "sample/warehouse" },
    });
    expect(
      h.configuration.projects.list().find((p) => p.binding === "delivery")?.configuration,
    ).toMatchObject({ state: "pending" });
    const before = h.platform.calls.filter((c) => c.method === "POST").length;
    const planned = await h.plan("delivery");
    expect(planned.scopes.map((s) => s.scope.name)).toEqual(["sample/depot", "sample/warehouse"]);
    expect(
      planned.changes.filter((c) => c.scope?.name === "sample/warehouse").map((c) => c.storage),
    ).toEqual(["label", "label", "milestone"]);
    expect(h.platform.calls.filter((c) => c.method === "POST")).toHaveLength(before);
    await h.configuration.projects.apply("delivery", { removeUndeclared: true });
    expect((await h.plan("delivery")).configuration).toEqual({ state: "in-sync" });
    expect(
      (await h.configuration.projects.apply("delivery", { removeUndeclared: true })).writes,
    ).toBe(0);
  } finally {
    await h.close();
  }
});
