// ---
// relationships:
//   verifies: task-metadata
//   references: task-metadata-declaration
// ---
import { readFileSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import { parse } from "yaml";
import { lintTaskMetadataDeclaration, scopeOwnership } from "@wyrd-company/manifold-shared";
import { planScopeConfiguration } from "./scope-plan.ts";
import type { ScopeInput } from "./project-types.ts";
const fixtures = parse(
  readFileSync(
    new URL(
      "../../../../docs/specifications/task-metadata-declaration.fixtures.yml",
      import.meta.url,
    ),
    "utf8",
  ),
) as {
  bindings: Record<string, string>;
  declarations: { name: string; bindings: string; taskMetadata: string }[];
};
function input(): ScopeInput {
  const fixture = fixtures.declarations[0]!;
  const lint = lintTaskMetadataDeclaration({
    taskMetadata: fixture.taskMetadata,
    bindings: fixtures.bindings[fixture.bindings],
  });
  if (!lint.ok) throw new Error(JSON.stringify(lint.findings));
  const owned = scopeOwnership(lint.declaration, {}, () => ["example-org/depot"]).get(
    "organization:example-org",
  )!;
  return {
    scope: owned.scope,
    owned,
    bindings: owned.bindings,
    observed: {
      scope: owned.scope,
      status: "ready",
      readAt: 1,
      issueFields: [],
      issueTypes: [],
      labels: [],
      milestones: [],
    },
    applied: undefined,
  };
}
test("shared fixture plans the complete union once and dispatches in storage order", () => {
  const planned = planScopeConfiguration(input());
  expect(planned.writes.map((group) => group.write.kind)).toEqual([
    "issue-field-create",
    "issue-type-create",
    "issue-type-create",
  ]);
  expect(
    planned.changes.every((change) => change.scope?.bindings.join() === "parcels,returns"),
  ).toBe(true);
});
test("shared applied identity preserves an external type rename and converges", () => {
  const base = input();
  const owned = {
    ...base.owned,
    entities: base.owned.entities.filter((entity) => entity.key === "issue-type:parcel"),
  };
  const initial = {
    scope: base.scope,
    status: "ready" as const,
    readAt: 1,
    issueFields: [],
    issueTypes: [
      { nodeId: "T_one", name: "Parcel", color: "gray" as const, description: "", enabled: true },
    ],
    labels: [],
    milestones: [],
  };
  const applied = planScopeConfiguration({ ...base, owned, observed: initial }).applied!;
  const renamed = { ...initial, issueTypes: [{ ...initial.issueTypes[0]!, name: "Packet" }] };
  const planned = planScopeConfiguration({ ...base, owned, observed: renamed, applied });
  expect(planned.changes).toMatchObject([{ action: "change", drift: true, properties: ["name"] }]);
  expect(planned.writes[0]?.write).toEqual({
    kind: "issue-type-update",
    organization: "example-org",
    nodeId: "T_one",
    name: "Parcel",
  });
  expect(planScopeConfiguration({ ...base, owned, observed: initial, applied }).changes).toEqual(
    [],
  );
});
