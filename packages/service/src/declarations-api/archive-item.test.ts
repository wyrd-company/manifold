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

test("created project choices become bindings without changing creation provenance", () => {
  const records = ["p1", "p2", "p3"].map((project) => ({
    environment: "local",
    project,
    actorId: "a1",
    item: "beta",
  }));
  const result = archiveItemEdit(
    { portfolio, bindings: "" },
    {
      item: "beta",
      projects: [
        { created: { environment: "local", project: "p1" }, name: "t3-first", choice: "move" },
        {
          created: { environment: "local", project: "p2" },
          name: "t3-second",
          choice: "reassign",
          item: "gamma",
        },
        { created: { environment: "local", project: "p3" }, name: "t3-third", choice: "archive" },
      ],
    },
    records,
  );
  expect(result.ok).toBe(true);
  if (!result.ok) throw Error(JSON.stringify(result.findings));
  expect(parse(result.bindings).t3codeProjects).toEqual({
    "t3-first": { environment: "local", project: "p1", item: "alpha" },
    "t3-second": { environment: "local", project: "p2", item: "gamma" },
    "t3-third": { environment: "local", project: "p3", item: "beta", archived: true },
  });
  expect(records.every((r) => r.item === "beta")).toBe(true);
});
test("created choices enforce attachment, completeness, siblings and declaration names", () => {
  const record = { environment: "local", project: "p1", actorId: "a1", item: "beta" };
  for (const [projects, kind] of [
    [[], "choice-missing"],
    [
      [
        {
          created: { environment: "local", project: "p1" },
          name: "chosen",
          choice: "reassign",
          item: "delta",
        },
      ],
      "not-sibling",
    ],
    [
      [{ created: { environment: "local", project: "absent" }, name: "chosen", choice: "archive" }],
      "not-created",
    ],
    [
      [{ created: { environment: "local", project: "p1" }, name: "board-one", choice: "archive" }],
      "name-taken",
    ],
  ] as const) {
    const result = archiveItemEdit({ portfolio, bindings }, { item: "beta", projects }, [record]);
    expect(result.ok).toBe(false);
    if (result.ok) throw Error("Expected refusal");
    expect(result.findings).toContainEqual(expect.objectContaining({ kind }));
  }
});
test("archive of a created project on an Other binds its parent", () => {
  const result = archiveItemEdit(
    { portfolio, bindings: "" },
    {
      item: "alpha",
      projects: [
        { created: { environment: "local", project: "p1" }, name: "chosen", choice: "archive" },
      ],
    },
    [{ environment: "local", project: "p1", actorId: "a1", item: "alpha/other" }],
  );
  expect(result.ok).toBe(true);
  if (result.ok)
    expect(parse(result.bindings).t3codeProjects.chosen).toMatchObject({
      item: "alpha",
      archived: true,
    });
});

test("a created project on a top-level item cannot move up", () => {
  const result = archiveItemEdit(
    { portfolio, bindings: "" },
    {
      item: "delta",
      projects: [
        { created: { environment: "local", project: "p1" }, name: "chosen", choice: "move" },
      ],
    },
    [{ environment: "local", project: "p1", actorId: "a1", item: "delta" }],
  );
  expect(result.ok).toBe(false);
  if (!result.ok)
    expect(result.findings).toContainEqual(expect.objectContaining({ kind: "no-parent" }));
});
test("created choices cannot duplicate an identity or a name in either binding section", () => {
  const records = ["p1", "p2"].map((project) => ({
    environment: "local",
    project,
    actorId: "a1",
    item: "beta",
  }));
  const first = {
    created: { environment: "local", project: "p1" },
    name: "chosen",
    choice: "archive" as const,
  };
  const duplicate = archiveItemEdit(
    { portfolio, bindings: "" },
    { item: "beta", projects: [first, { ...first, name: "second" }] },
    records,
  );
  expect(duplicate.ok).toBe(false);
  if (!duplicate.ok)
    expect(duplicate.findings).toContainEqual(
      expect.objectContaining({ kind: "duplicate-choice" }),
    );
  for (const bindings of [
    "githubProjects:\n  chosen: {owner: sample, number: 1, environment: local, item: gamma}\n",
    "t3codeProjects:\n  chosen: {environment: local, project: p3, item: gamma}\n",
  ]) {
    const result = archiveItemEdit(
      { portfolio, bindings },
      {
        item: "beta",
        projects: [first, { ...first, created: { environment: "local", project: "p2" } }],
      },
      records,
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.findings).toContainEqual(expect.objectContaining({ kind: "name-taken" }));
  }
});

test("existing created records outside attachment remain not-attached", () => {
  for (const record of [
    { environment: "local", project: "p1", actorId: "a1", item: "gamma" },
    { environment: "local", project: "p1", actorId: "a1", item: "beta", retirable: true },
    { environment: "local", project: "workspace-one", actorId: "a1", item: "beta" },
  ]) {
    const result = archiveItemEdit(
      { portfolio, bindings },
      {
        item: "beta",
        projects: [
          {
            created: { environment: record.environment, project: record.project },
            name: "chosen",
            choice: "archive",
          },
        ],
      },
      [record],
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw Error("Expected refusal");
    expect(result.findings).toContainEqual(expect.objectContaining({ kind: "not-attached" }));
    expect(result.findings.some((f) => f.kind === "not-created")).toBe(false);
  }
});
