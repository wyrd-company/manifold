// ---
// relationships:
//   verifies: declarations-api
// ---
import { expect, test } from "vite-plus/test";
import { parse } from "yaml";
import { archiveItemEdit } from "./archive-item.ts";
const portfolio =
  "# portfolio comment\nitems:\n  alpha:\n    items:\n      beta: {}\n      gamma: {}\n  delta: {}\n";
const bindings =
  "# bindings comment\ngithubProjects:\n  board-one: { owner: sample, number: 1, environment: local, item: beta, t3codeProjects: [workspace-one] }\n  board-two: { owner: sample, number: 2, environment: local, item: beta }\n";
test("archive edits both documents, keeps comments and associations, and converges", () => {
  const request = {
    item: "beta",
    projects: [
      { binding: "board-one", choice: "move" as const },
      { binding: "board-two", choice: "reassign" as const, item: "gamma" },
    ],
  };
  const result = archiveItemEdit({ portfolio, bindings }, request);
  expect(result.ok).toBe(true);
  if (!result.ok) throw Error("Expected archive");
  expect(result.portfolio).toContain("# portfolio comment");
  expect(result.bindings).toContain("# bindings comment");
  expect(parse(result.portfolio).items.alpha.items.beta.archived).toBe(true);
  expect(parse(result.bindings).githubProjects).toMatchObject({
    "board-one": { item: "alpha", t3codeProjects: ["workspace-one"] },
    "board-two": { item: "gamma" },
  });
  const again = archiveItemEdit(result, { item: "beta", projects: [] });
  expect(again).toEqual(result);
});
test.each([
  [{ item: "missing", projects: [] }, "item-missing"],
  [{ item: "beta", projects: [{ binding: "absent", choice: "archive" }] }, "name-missing"],
  [{ item: "delta", projects: [{ binding: "board-one", choice: "archive" }] }, "not-attached"],
  [
    {
      item: "beta",
      projects: [
        { binding: "board-one", choice: "archive" },
        { binding: "board-one", choice: "archive" },
      ],
    },
    "duplicate-choice",
  ],
  [{ item: "alpha", projects: [{ binding: "board-one", choice: "move" }] }, "no-parent"],
] as const)("refuses invalid archive choices %j", (request, kind) => {
  const result = archiveItemEdit({ portfolio, bindings }, request);
  expect(result.ok).toBe(false);
  if (result.ok) throw Error("Expected refusal");
  expect(result.findings).toContainEqual(expect.objectContaining({ kind }));
});
test("missing choices and invalid targets are linted together with the archived item", () => {
  for (const projects of [
    [],
    [{ binding: "board-one", choice: "reassign" as const, item: "other" }],
  ]) {
    const result = archiveItemEdit({ portfolio, bindings }, { item: "beta", projects });
    expect(result.ok).toBe(false);
    if (result.ok) throw Error("Expected refusal");
    expect(result.findings).toContainEqual(
      expect.objectContaining({ kind: "archived-item", file: "bindings" }),
    );
  }
});
