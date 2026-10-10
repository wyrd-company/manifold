// ---
// relationships:
//   verifies: task-metadata
// ---
import { expect, test } from "vite-plus/test";
import { parse } from "yaml";
import { acceptFields } from "./accept.ts";
import type { PlanInput, PlanChange } from "./project-types.ts";
test("Accept updates every organization owner declaration and preserves storage and unowned option properties", () => {
  const text = `projects:
  first:
    fields:
      priority: {type: single-select, storage: {kind: issue-field, organization: example, name: Urgency}, whenChanged: accept, options: [Normal]}
      category: {type: single-select, storage: {kind: issue-type, organization: example}, whenChanged: accept, options: [Request, Other]}
  second:
    fields:
      priority: {type: single-select, storage: {kind: issue-field, organization: example, name: Urgency}, whenChanged: accept, options: [Normal]}
      category: {type: single-select, storage: {kind: issue-type, organization: example}, whenChanged: accept, options: [Request]}
`;
  const scope = { kind: "organization" as const, organization: "example" };
  const entities = [
    {
      key: "issue-field:Urgency",
      storage: "issue-field" as const,
      name: "Urgency",
      type: "single-select" as const,
      whenChanged: "accept" as const,
      declarations: [
        { binding: "first", field: "priority" },
        { binding: "second", field: "priority" },
      ],
    },
    {
      key: "issue-type:request",
      storage: "issue-type" as const,
      name: "Request",
      whenChanged: "accept" as const,
      declarations: [
        { binding: "first", field: "category" },
        { binding: "second", field: "category" },
      ],
    },
  ];
  const input: PlanInput = {
    metadata: undefined,
    fields: [],
    applied: undefined,
    scopes: [
      {
        scope,
        bindings: ["first", "second"],
        owned: { scope, bindings: ["first", "second"], prefixes: [], entities },
        observed: undefined,
        applied: undefined,
      },
    ],
  };
  const base = {
    id: "change",
    target: { field: "Urgency", taskField: "priority", lifecycle: false },
    scope: { kind: "organization" as const, name: "example", bindings: ["first", "second"] },
    description: "Accept",
    action: "change" as const,
    side: "declaration" as const,
    drift: true,
    requiresRemoval: false,
    properties: [],
    from: null,
  };
  const changes: PlanChange[] = [
    {
      ...base,
      storage: "issue-field",
      to: {
        name: "Importance",
        type: "single-select",
        options: [{ name: "Routine", color: "blue", description: "Unowned" }],
      },
    },
    {
      ...base,
      id: "type",
      storage: "issue-type",
      target: { field: "Request", taskField: "category", lifecycle: false },
      to: {
        entity: "issue-type",
        name: "Inquiry",
        color: "green",
        description: "Unowned",
        enabled: true,
      },
    },
  ];
  const updated = parse(acceptFields(text, "first", changes, input));
  for (const binding of ["first", "second"]) {
    expect(updated.projects[binding].fields.priority.storage).toEqual({
      kind: "issue-field",
      organization: "example",
      name: "Importance",
    });
    expect(updated.projects[binding].fields.priority.options).toEqual(["Routine"]);
    expect(updated.projects[binding].fields.category.options[0]).toBe("Inquiry");
  }
  expect(updated.projects.first.fields.category.options).toEqual(["Inquiry", "Other"]);
});
