// ---
// relationships:
//   verifies: github-event-source
// ---
import { expect, test, vi } from "vite-plus/test";
import { openStore } from "../store/index.ts";
import { githubSteps } from "./migrations.ts";
import { createMirror, trackedIssueIndex } from "./mirror.ts";
import { startGitHubSource } from "./index.ts";
import { startRouter } from "../router/index.ts";

test.each([10, 1000])("all tracked issues share one mirror read over %i issues", async (size) => {
  const store = openStore({ path: ":memory:" });
  const router = startRouter({
    store,
    host: {
      subscription: () => ({ topics: [] }),
      restore: () => ({ status: "held", reason: "test" }),
    },
  });
  let source: ReturnType<typeof startGitHubSource> | undefined;
  try {
    store.connection.migrate("github", githubSteps);
    const mirror = createMirror(store, () => 0);
    const project = { nodeId: "project", owner: "example", number: 1 };
    const bound = new Map([[project.nodeId, project]]);
    const before = mirror.read(),
      after = mirror.read();
    after.projects.set(project.nodeId, { project, closed: false, revision: 0 });
    for (let i = size - 1; i >= 0; i--) {
      const id = `parcel-${i}`;
      after.issues.set(id, {
        issue: {
          nodeId: id,
          repository: "example/delivery",
          number: i + 1,
          state: "open",
          stateReason: null,
        },
        baselined: true,
        present: true,
        revision: 0,
      });
      after.items.set(id, {
        item: { nodeId: id, contentType: "issue", contentNodeId: id },
        projectId: project.nodeId,
        present: true,
        archived: i === 1,
        revision: 0,
      });
      after.fields.set(id, {
        itemId: id,
        field: { nodeId: "stage", name: "Stage" },
        value: { kind: "single-select", optionId: "ready", name: "Ready" },
        revision: 0,
      });
    }
    for (const [id, baselined, present, projectId] of [
      ["unbaselined", false, true, "project"],
      ["absent", true, false, "project"],
      ["unbound", true, true, "other-project"],
      ["outside", true, true, undefined],
    ] as const) {
      after.issues.set(id, {
        issue: {
          nodeId: id,
          repository: "example/delivery",
          number: size + 1,
          state: "open",
          stateReason: null,
        },
        baselined,
        present,
        revision: 0,
      });
      if (projectId)
        after.items.set(id, {
          item: { nodeId: id, contentType: "issue", contentNodeId: id },
          projectId,
          present: true,
          archived: false,
          revision: 0,
        });
    }
    after.items.set("removed-item", {
      item: { nodeId: "removed-item", contentType: "issue", contentNodeId: "outside" },
      projectId: "project",
      present: false,
      archived: false,
      revision: 0,
    });
    after.items.set("pull-request", {
      item: { nodeId: "pull-request", contentType: "pull-request", contentNodeId: "outside" },
      projectId: "project",
      present: true,
      archived: false,
      revision: 0,
    });
    after.items.set("duplicate", {
      item: { nodeId: "duplicate", contentType: "issue", contentNodeId: "parcel-0" },
      projectId: "project",
      present: true,
      archived: true,
      revision: 0,
    });
    after.dependencies.set("one", { from: "parcel-0", to: "outside", present: true, revision: 0 });
    after.dependencies.set("two", { from: "parcel-1", to: "parcel-0", present: true, revision: 0 });
    after.dependencies.set("removed", {
      from: "parcel-0",
      to: "parcel-2",
      present: false,
      revision: 0,
    });
    after.subIssues.set("one", { from: "parcel-0", to: "parcel-1", present: true, revision: 0 });
    after.subIssues.set("two", { from: "parcel-1", to: "parcel-2", present: true, revision: 0 });
    after.subIssues.set("removed", {
      from: "parcel-0",
      to: "parcel-3",
      present: false,
      revision: 0,
    });
    after.issues.get("parcel-0")!.content = {
      body: "---\nweight: 3\n---\nPack.\n",
      lastEditedAt: 10,
      labels: [{ nodeId: "label-small", name: "small" }],
      milestone: { nodeId: "milestone-north", number: 1, title: "North" },
      issueType: { nodeId: "type-parcel", name: "Parcel" },
      issueFields: [
        { fieldNodeId: "weight", name: "Weight", value: { kind: "number", number: 3 } },
      ],
    };
    mirror.write(before, after);
    source = startGitHubSource({
      store,
      router,
      configuration: {
        apiUrl: "http://127.0.0.1:1",
        owners: {},
        sweepIntervalMs: 900000,
        redeliveryIntervalMs: 60000,
        requestTimeoutMs: 30000,
      },
      credentials: {
        names: [],
        resolve: () => {
          throw new Error("No credentials needed for mirror reads");
        },
      },
      boundProjects: () => [{ owner: project.owner, number: project.number }],
      processRepository: {
        url: "https://example.test/process.git",
        branch: "main",
        pull: async () => ({ kind: "unchanged", commit: "a".repeat(40) }),
      },
    });
    const prepare = vi.spyOn(store.connection.database, "prepare");
    const index = source.trackedIssueIndex();
    const tracked = [...index.values()];
    for (const table of ["issue", "project", "item", "field_value", "dependency", "sub_issue"])
      expect(
        prepare.mock.calls.filter(([sql]) => new RegExp(`\\bFROM github_${table}$`).test(sql)),
      ).toHaveLength(1);
    prepare.mockRestore();
    expect(source.trackedIssues()).toEqual(tracked);
    const ids = Array.from({ length: size }, (_, i) => `parcel-${i}`).sort();
    expect([...trackedIssueIndex(after, bound).keys()]).toEqual(ids);
    expect(tracked.map((t) => t.issue.nodeId)).toEqual(ids);
    expect(mirror.trackedIssueIds(bound)).toEqual(ids);
    if (size === 10) expect(tracked).toEqual(ids.map((id) => source!.trackedIssue(id)));
    else
      for (const id of [ids[0]!, ids[500]!, ids[999]!])
        expect(tracked.find((t) => t.issue.nodeId === id)).toEqual(source.trackedIssue(id));
    const first = tracked.find((t) => t.issue.nodeId === "parcel-0")!;
    expect(first.content).toEqual(after.issues.get("parcel-0")!.content);
    expect(first.projects).toEqual([project]);
    expect(first.items.map((i) => i.nodeId)).toEqual(["duplicate", "parcel-0"]);
    expect(first.items.find((i) => i.nodeId === "parcel-0")?.fields).toEqual({
      Stage: { kind: "single-select", optionId: "ready", name: "Ready" },
    });
    expect(first.blockedBy.map((i) => i.nodeId)).toEqual(["outside"]);
    expect(first.blocking.map((i) => i.nodeId)).toEqual(["parcel-1"]);
    expect(first.subIssues.map((i) => i.nodeId)).toEqual(["parcel-1"]);
    expect(tracked.find((t) => t.issue.nodeId === "parcel-1")?.parent?.nodeId).toBe("parcel-0");
    expect(tracked.find((t) => t.issue.nodeId === "parcel-1")?.items[0]?.archived).toBe(true);
    for (const id of ["unbaselined", "absent", "unbound", "outside", "unknown"])
      expect(mirror.trackedIssue(id, bound)).toBeUndefined();
    const changed = mirror.read();
    changed.items.get("parcel-0")!.present = false;
    changed.items.get("duplicate")!.present = false;
    mirror.write(after, changed);
    expect(mirror.trackedIssues(bound).map((t) => t.issue.nodeId)).toEqual(
      ids.filter((id) => id !== "parcel-0"),
    );
    expect(mirror.trackedIssue("parcel-0", bound)).toBeUndefined();
    expect(index.has("parcel-0")).toBe(true);
    expect(source.trackedIssueIndex().has("parcel-0")).toBe(false);
  } finally {
    await source?.stop();
    router.stop();
    store.close();
  }
});
