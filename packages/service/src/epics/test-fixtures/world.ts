// ---
// relationships:
//   verifies: [epics-api, operator-console]
// ---
import { boardWorld } from "../../tasks/test-fixtures/world.ts";
import { openEpics } from "../index.ts";
export function epicWorld() {
  const f = boardWorld(),
    before = f.mirror.read(),
    after = f.mirror.read();
  const rows = [
    ["root", 10, "Deliver orders", "open", true],
    ["branch", 11, "Sort parcels", "open", true],
    ["parcel", 2, "Deliver parcel", "open", true],
    ["waiting", 1, "Collect parcel", "closed", true],
    ["untracked", 12, "Pack parcel", "open", false],
    ["hidden", 13, "Seal parcel", "open", false],
    ["outside", 20, "Prepare vehicle", "open", true],
    ["other", 21, "Load vehicle", "open", true],
    ["external", 30, "Inspect route", "open", false],
    ["external-two", 31, "Inspect road", "open", false],
    ["closed-root", 40, "Finish deliveries", "closed", true],
    ["closed-child", 41, "File receipt", "closed", true],
    ["orphan", 50, "Return deliveries", "open", true],
    ["orphan-child", 51, "Return parcel", "open", true],
  ] as const;
  for (const [id, number, title, state, tracked] of rows) {
    after.issues.set(id, {
      issue: {
        nodeId: id,
        repository: "example/delivery",
        number,
        title,
        state,
        stateReason: state === "closed" ? "completed" : null,
        url: `https://example.test/issues/${number}`,
      },
      present: true,
      baselined: true,
      revision: 0,
    });
    if (tracked)
      after.items.set(`item-${id}`, {
        item: { nodeId: `item-${id}`, contentType: "issue", contentNodeId: id },
        projectId: "project-1",
        present: true,
        archived: false,
        revision: 0,
      });
  }
  for (const [from, to] of [
    ["root", "branch"],
    ["root", "waiting"],
    ["root", "untracked"],
    ["branch", "parcel"],
    ["untracked", "hidden"],
    ["outside", "other"],
    ["closed-root", "closed-child"],
    ["external", "orphan"],
    ["orphan", "orphan-child"],
  ])
    after.subIssues.set(from + ":" + to, { from: from!, to: to!, present: true, revision: 0 });
  // mirror dependencies point from the blocked issue to its blocker.
  for (const [from, to] of [
    ["parcel", "waiting"],
    ["parcel", "branch"],
    ["branch", "outside"],
    ["branch", "external"],
    ["external-two", "parcel"],
    ["external-two", "external"],
  ])
    after.dependencies.set(from + ":" + to, { from: from!, to: to!, present: true, revision: 0 });
  f.mirror.write(before, after);
  const references = new Map(
    f.projects.map((p) => [
      `project-${p.number}`,
      { nodeId: `project-${p.number}`, owner: p.owner, number: p.number },
    ]),
  );
  const github = {
    trackedIssueIds: () => f.mirror.trackedIssueIds(references),
    trackedIssue: (id: string) => f.mirror.trackedIssue(id, references),
  };
  return { ...f, github, epics: openEpics({ github, tasks: f.tasks }) };
}
