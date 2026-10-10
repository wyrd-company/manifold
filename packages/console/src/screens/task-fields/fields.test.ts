// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { fieldAtCursor, rowFindings, fieldGroups, fieldScope } from "./fields.ts";
const fields = [
  {
    binding: "sample",
    name: "Phase",
    lifecycle: true,
    location: "/projects/sample/lifecycle",
    range: { from: 4, to: 10, line: 2, column: 1 },
  },
  {
    binding: "sample",
    name: "Size",
    lifecycle: false,
    location: "/projects/sample/fields/Size",
    range: { from: 12, to: 25, line: 3, column: 1 },
  },
];
test("field selection and findings follow locations and exact range boundaries", () => {
  expect(fieldAtCursor(12, fields)).toEqual(fields[1]);
  expect(fieldAtCursor(25, fields)).toBeUndefined();
  const findings = [
    { kind: "schema", location: "/projects/sample/fields/Size/type", message: "Invalid type" },
  ];
  expect(rowFindings(fields, findings).get(fields[1]!.location)).toEqual({
    error: true,
    typeOrStorage: true,
  });
  expect(rowFindings(fields, findings).get(fields[0]!.location)).toEqual({
    error: false,
    typeOrStorage: false,
  });
  expect(fieldGroups(fields, [])).toMatchObject([{ binding: "sample", fields }]);
});

test("field scope names shared organizations, repositories and issue bodies", () => {
  expect(
    fieldScope({
      ...fields[1]!,
      scope: { kind: "organization", names: ["sample-org"], sharedWith: ["other"] },
    }),
  ).toBe("Organization sample-org");
  expect(
    fieldScope({
      ...fields[1]!,
      scope: { kind: "repository", names: ["sample/one", "sample/two"], sharedWith: [] },
    }),
  ).toBe("Repositories sample/one, sample/two");
  expect(
    fieldScope({
      ...fields[1]!,
      storage: "front-matter",
      scope: { kind: "issue", names: [], sharedWith: [] },
    }),
  ).toBe("In each issue's body");
});
