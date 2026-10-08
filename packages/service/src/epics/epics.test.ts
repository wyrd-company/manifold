// ---
// relationships:
//   verifies: epics-api
// ---
import { expect, test } from "vite-plus/test";
import { openEpics } from "./index.ts";
const issue = (nodeId: string, number: number, state: "open" | "closed" = "open") => ({
  nodeId,
  number,
  repository: "example/delivery",
  state,
});
test("roots and tree reads include outside dependencies once and stop at untracked children", () => {
  const root = issue("root", 1),
    child = issue("child", 2),
    leaf = issue("leaf", 3),
    outside = issue("outside", 4),
    untracked = issue("untracked", 5);
  const tracked = [
    { issue: root, subIssues: [untracked, child], blockedBy: [], blocking: [] },
    { issue: child, parent: root, subIssues: [leaf], blockedBy: [outside], blocking: [leaf] },
    { issue: leaf, parent: child, subIssues: [], blockedBy: [child], blocking: [] },
    { issue: outside, subIssues: [issue("another", 6)], blockedBy: [], blocking: [child] },
  ];
  const epics = openEpics({
    github: {
      trackedIssueIds: () => tracked.map((t) => t.issue.nodeId),
      trackedIssue: (id) => tracked.find((t) => t.issue.nodeId === id),
    },
    tasks: {
      list: () => ({
        projects: [
          {
            binding: "deliveries",
            owner: "example",
            number: 1,
            item: "delivery",
            tasks: [{ actorId: "task:child", issue: child, status: "Ready", openEscalations: 1 }],
          },
        ],
      }),
    },
  });
  expect(epics.roots().roots.map((r) => r.issue.nodeId)).toEqual(["root", "outside"]);
  expect(
    epics.get("root")?.epic.issues.map((i) => [i.issue.nodeId, i.placement, i.parent]),
  ).toEqual([
    ["root", "root", undefined],
    ["child", "tree", "root"],
    ["leaf", "tree", "child"],
    ["untracked", "tree", "root"],
    ["outside", "outside", undefined],
  ]);
  expect(epics.get("root")?.epic.dependencies).toEqual([
    { blocking: "outside", blocked: "child" },
    { blocking: "child", blocked: "leaf" },
  ]);
  expect(epics.get("root")?.epic.issues[1]?.task).toEqual({
    actorId: "task:child",
    projects: [{ binding: "deliveries", status: "Ready" }],
    openEscalations: 1,
  });
  expect(epics.get("child")?.epic.root).toBe("child");
  expect(epics.get("untracked")).toBeUndefined();
});

test("tree walks stop revisits and dependency cycles remain GitHub's", () => {
  const a = issue("a", 1),
    b = issue("b", 2),
    c = issue("c", 3);
  const tracked = [
    { issue: a, subIssues: [b, c], blockedBy: [c], blocking: [b] },
    { issue: b, parent: a, subIssues: [c], blockedBy: [a], blocking: [c] },
    { issue: c, parent: b, subIssues: [a], blockedBy: [b], blocking: [a] },
  ];
  const epics = openEpics({
    github: {
      trackedIssueIds: () => tracked.map((t) => t.issue.nodeId),
      trackedIssue: (id) => tracked.find((t) => t.issue.nodeId === id),
    },
    tasks: { list: () => ({ projects: [] }) },
  });
  expect(epics.get("a")?.epic.issues.map((i) => [i.issue.nodeId, i.parent])).toEqual([
    ["a", undefined],
    ["b", "a"],
    ["c", "b"],
  ]);
  expect(epics.get("a")?.epic.dependencies).toEqual([
    { blocking: "c", blocked: "a" },
    { blocking: "a", blocked: "b" },
    { blocking: "b", blocked: "c" },
  ]);
});
