// ---
// relationships:
//   verifies: task-metadata
// ---
import { expect, test } from "vite-plus/test";
import { taskFieldValues } from "./index.ts";
import type { TrackedIssue } from "../github-source/index.ts";
import { lintTaskMetadataDeclaration } from "@wyrd-company/manifold-shared";
const project = { nodeId: "P1", owner: "sample", number: 1 };
const declaration = lintTaskMetadataDeclaration({
  bindings:
    "githubProjects: { parcels: { owner: sample, number: 1, environment: local, item: parcels } }",
  taskMetadata: `projects:
 parcels:
  lifecycle: {field: Stage, options: [Packed]}
  repositories: [sample/depot]
  fields:
   Note: {type: text}
   Weight: {type: number, storage: {kind: issue-field}}
   Kind: {type: single-select, storage: {kind: issue-type}, options: [Parcel]}
   Size: {type: single-select, storage: {kind: label, prefix: 'size: '}, options: [Small, Large]}
   Route: {type: single-select, storage: {kind: milestone}, options: [North]}
   Due: {type: date, storage: {kind: front-matter, key: due}}
`,
});
if (!declaration.ok) throw new Error(JSON.stringify(declaration.findings));
const metadata = declaration.declaration.projects["parcels"]!;
const issue: TrackedIssue = {
  issue: { nodeId: "I1", repository: "sample/depot", number: 1, state: "open", stateReason: null },
  blockedBy: [],
  blocking: [],
  subIssues: [],
  parent: undefined,
  projects: [project],
  items: [
    {
      project,
      nodeId: "ITEM1",
      archived: false,
      fields: { Note: { kind: "text", text: "Handle gently" } },
    },
  ],
  content: {
    labels: [{ nodeId: "L1", name: "size: small" }],
    milestone: { nodeId: "M1", number: 1, title: "North" },
    issueType: { nodeId: "T1", name: "parcel" },
    issueFields: [{ fieldNodeId: "F1", name: "Weight", value: { kind: "number", number: 3 } }],
    body: "---\ndue: 2026-01-02\n---\nPack.\n",
    lastEditedAt: null,
  },
};
test("values normalize every storage kind from one supplied snapshot", () => {
  expect(taskFieldValues({ metadata, project, issue, inScope: () => true })).toEqual({
    Note: { state: "set", value: "Handle gently" },
    Weight: { state: "set", value: 3 },
    Kind: { state: "set", value: "Parcel" },
    Size: { state: "set", value: "Small" },
    Route: { state: "set", value: "North" },
    Due: { state: "set", value: "2026-01-02" },
  });
});
test("missing content and outside ownership differ from empty and invalid", () => {
  const { content: _, ...unread } = issue;
  expect(
    taskFieldValues({ metadata, project, issue: unread, inScope: () => true })["Due"]?.state,
  ).toBe("unavailable");
  const values = taskFieldValues({
    metadata,
    project,
    issue: {
      ...issue,
      content: {
        ...issue.content!,
        labels: [...issue.content!.labels, { nodeId: "L2", name: "size: large" }],
        body: "---\ndue: 2026-02-30\n---\n",
      },
    },
    inScope: () => true,
  });
  expect(values["Size"]?.state).toBe("invalid");
  expect(values["Due"]?.state).toBe("invalid");
  expect(taskFieldValues({ metadata, project, issue, inScope: () => false })["Size"]?.state).toBe(
    "unavailable",
  );
});
