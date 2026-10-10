// ---
// relationships:
//   verifies: task-metadata-declaration
// ---
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { expect, test } from "vite-plus/test";
import {
  lintTaskMetadataDeclaration,
  scopeOwnership,
  scopeKey,
  parseFrontMatter,
  setFrontMatter,
} from "./index.ts";
const fixtures = parse(
  readFileSync(
    new URL("../../../docs/specifications/task-metadata-declaration.fixtures.yml", import.meta.url),
    "utf8",
  ),
) as {
  bindings: Record<string, string>;
  declarations: {
    name: string;
    bindings: string;
    taskMetadata: string;
    findings?: { kind: string; location: string }[];
    ok?: {
      scopes: Record<string, { entities: string[]; prefixes?: string[] }>;
      undeclared?: Record<string, { observed: string[]; removable: string[] }>;
    };
  }[];
  frontMatter: {
    name: string;
    body: string;
    read: { block: string };
    write?: { key: string; value: string | number | null; after?: string; refused?: string }[];
  }[];
};
for (const fixture of fixtures.declarations)
  test(fixture.name, () => {
    const result = lintTaskMetadataDeclaration({
      taskMetadata: fixture.taskMetadata,
      bindings: fixtures.bindings[fixture.bindings],
    });
    if (fixture.findings) {
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.findings.map(({ kind, location }) => ({ kind, location }))).toEqual(
          fixture.findings,
        );
      return;
    }
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bindings = parse(fixtures.bindings[fixture.bindings]!) as {
      githubProjects: Record<string, { owner: string }>;
    };
    const scopes = scopeOwnership(
      result.declaration,
      Object.fromEntries(
        Object.entries(bindings.githubProjects).map(([name, value]) => [name, value.owner]),
      ),
      () => ["example-org/depot"],
    );
    for (const [key, expected] of Object.entries(fixture.ok!.scopes)) {
      const scope = scopes.get(key)!;
      expect(scopeKey(scope.scope)).toBe(key);
      expect(scope.entities.map((entity) => entity.key).sort()).toEqual(expected.entities);
      if (expected.prefixes) expect(scope.prefixes).toEqual(expected.prefixes);
      const undeclared = fixture.ok!.undeclared?.[key];
      if (undeclared) {
        const declared = new Set(
          scope.entities
            .filter((entity) => entity.storage === "label")
            .map((entity) => entity.name.toLowerCase()),
        );
        const prefixes = scope.prefixes.map((prefix) => prefix.toLowerCase());
        expect(
          undeclared.observed.filter(
            (name) =>
              !declared.has(name.toLowerCase()) &&
              prefixes.some((prefix) => name.toLowerCase().startsWith(prefix)),
          ),
        ).toEqual(undeclared.removable);
      }
    }
  });
for (const fixture of fixtures.frontMatter)
  test(fixture.name, () => {
    expect(parseFrontMatter(fixture.body).state).toBe(fixture.read.block);
    let body = fixture.body;
    for (const write of fixture.write ?? []) {
      if (write.refused) expect(() => setFrontMatter(body, write.key, write.value)).toThrow();
      else {
        body = setFrontMatter(body, write.key, write.value);
        expect(body).toBe(write.after);
      }
    }
  });
test("front matter changes preserve inline comments, quote styles and multiline prose", () => {
  const body =
    "---\nweight: 3 # measured\nsummary: 'Keep quoted text' # description\nnotes: |\n  First line.\n  Second line.\n---\n\nBody stays.\n";
  const changed = setFrontMatter(body, "weight", 4);
  expect(changed).toContain("weight: 4 # measured\n");
  expect(changed).toContain("summary: 'Keep quoted text' # description\n");
  expect(changed).toContain("notes: |\n  First line.\n  Second line.\n");
  expect(parseFrontMatter(changed)).toMatchObject({ state: "present", rest: "\nBody stays.\n" });
  const quoted = setFrontMatter(body, "summary", "Changed quoted text");
  expect(quoted).toContain("summary: 'Changed quoted text' # description\n");
  const cleared = setFrontMatter(body, "weight", null);
  expect(cleared).toContain("# measured");
  expect(cleared).not.toContain("weight:");
});
test("clearing the last front matter key retains its comments", () => {
  const changed = setFrontMatter(
    "---\n# measured\nweight: 3 # exact\n---\n\nProse.\n",
    "weight",
    null,
  );
  expect(changed).toContain("# measured");
  expect(changed).toContain("# exact");
  expect(parseFrontMatter(changed)).toMatchObject({
    state: "present",
    values: {},
    rest: "\nProse.\n",
  });
});
test("wildcard ownership coalesces with explicit repositories and keeps sparse properties", () => {
  const result = lintTaskMetadataDeclaration({
    bindings: fixtures.bindings["two-of-one-organization"],
    taskMetadata: `projects:
  parcels:
    lifecycle: { field: Stage, options: [Sorting] }
    repositories: [EXAMPLE-ORG/*]
    fields:
      Size: { type: single-select, storage: { kind: label, prefix: "size: " }, options: [{ name: small, color: ff0000, description: Small }, large] }
  returns:
    lifecycle: { field: Stage, options: [Received] }
    repositories: [example-org/depot]
    fields:
      Size: { type: single-select, storage: { kind: label, prefix: "size: " }, options: [small, { name: large, description: Large }] }
`,
  });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const scopes = scopeOwnership(
    result.declaration,
    { parcels: "example-org", returns: "example-org" },
    () => ["example-org/depot", "other-org/depot"],
  );
  expect([...scopes.keys()]).toEqual(["repository:example-org/depot"]);
  const scope = scopes.get("repository:example-org/depot")!;
  expect(scope.entities).toMatchObject([
    {
      key: "label:size: small",
      color: "ff0000",
      description: "Small",
      declarations: [
        { binding: "parcels", field: "Size" },
        { binding: "returns", field: "Size" },
      ],
    },
    { key: "label:size: large", description: "Large" },
  ]);
  const conflict = lintTaskMetadataDeclaration({
    bindings: fixtures.bindings["two-of-one-organization"],
    taskMetadata: `projects:
  parcels:
    lifecycle: { field: Stage, options: [Sorting] }
    repositories: [example-org/*]
    fields:
      Size: { type: single-select, storage: { kind: label }, options: [{ name: small, color: ff0000 }] }
  returns:
    lifecycle: { field: Stage, options: [Received] }
    repositories: [example-org/depot]
    fields:
      Size: { type: single-select, storage: { kind: label }, options: [{ name: SMALL, color: 0000ff }] }
`,
  });
  expect(conflict).toMatchObject({
    ok: false,
    findings: [
      { kind: "shared-conflict", location: "/projects/returns/fields/Size/options/0/color" },
    ],
  });
});
test("replacing a structured front matter value preserves its comments", () => {
  const body = "---\nweight:\n  # measured\n  exact: 3 # calibrated\n---\nProse.\n";
  const changed = setFrontMatter(body, "weight", 4);
  expect(changed).toContain("# measured");
  expect(changed).toContain("# calibrated");
  expect(parseFrontMatter(changed)).toMatchObject({
    state: "present",
    values: { weight: 4 },
    rest: "Prose.\n",
  });
});
test("shared conflict identifies the earlier binding, field and conflicting property", () => {
  const result = lintTaskMetadataDeclaration({
    bindings: fixtures.bindings["two-of-one-organization"],
    taskMetadata: `projects:
  parcels:
    lifecycle: { field: Stage, options: [Sorting] }
    fields:
      Kind: { type: single-select, storage: { kind: issue-type }, options: [{ name: Parcel, color: red }] }
  returns:
    lifecycle: { field: Stage, options: [Received] }
    fields:
      Class: { type: single-select, storage: { kind: issue-type }, options: [{ name: parcel, color: blue }] }
`,
  });
  expect(result).toMatchObject({
    ok: false,
    findings: [{ kind: "shared-conflict", message: expect.stringContaining("parcels.Kind") }],
  });
  if (!result.ok) expect(result.findings[0]!.message).toContain("color differs");
});
