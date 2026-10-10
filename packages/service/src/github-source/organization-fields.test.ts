// ---
// relationships:
//   verifies: [github-event-source, task-metadata]
// ---
import { expect, test } from "vite-plus/test";
import { organizationFields } from "./organization-fields.ts";

const scope = { kind: "organization" as const, organization: "example" };
const rawField = {
  id: "F_one",
  name: "Urgency",
  dataType: "SINGLE_SELECT",
  options: [{ id: "O_one", name: "Normal", color: "GRAY", description: null }],
};
const rawType = { id: "T_one", name: "Request", color: "BLUE", description: null, isEnabled: true };
function fixture() {
  const calls: { text: string; variables: Record<string, unknown> }[] = [];
  const api = {
    query: async <T>(
      _owner: string,
      text: string,
      variables: Record<string, unknown>,
    ): Promise<T> => {
      calls.push({ text, variables });
      return {
        repositoryOwner: {
          __typename: "Organization",
          id: "ORG_one",
          issueFields: {
            nodes: [rawField],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
          issueTypes: {
            nodes: [rawType],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
        setIssueFieldValue: { issue: { id: "I_one" } },
        updateIssueIssueType: { issue: { id: "I_one" } },
      } as T;
    },
    rest: async <T>() => ({ data: {} as T }),
  };
  return { adapter: organizationFields(api, () => 42), calls, api };
}
test("organization observation normalizes both kinds through the adapter", async () => {
  const f = fixture();
  expect(await f.adapter.observeScope(scope)).toEqual({
    scope,
    readAt: 42,
    status: "ready",
    labels: [],
    milestones: [],
    issueFields: [
      {
        nodeId: "F_one",
        name: "Urgency",
        type: "single-select",
        options: [{ id: "O_one", name: "Normal", color: "gray", description: "" }],
      },
    ],
    issueTypes: [
      { nodeId: "T_one", name: "Request", color: "blue", description: "", enabled: true },
    ],
  });
});
test("organization writes refuse another repository owner before any request", async () => {
  const f = fixture();
  await expect(
    f.adapter.writeTaskField(
      {
        actorId: "actor",
        invokeId: "invoke",
        entryId: "entry",
        field: "Urgency",
        issueNodeId: "I_one",
        projectNodeId: "P_one",
        storage: { kind: "issue-field", organization: "example", name: "Urgency" },
        labels: [],
        repositories: [],
        value: "Normal",
      },
      { issue: { repository: "other/records" } } as Parameters<typeof f.adapter.writeTaskField>[1],
    ),
  ).rejects.toMatchObject({ kind: "out-of-scope" });
  expect(f.calls).toEqual([]);
});
test("issue field values resolve option identity; issue types compare names without case", async () => {
  const f = fixture();
  const issue = { issue: { repository: "example/records" } } as Parameters<
    typeof f.adapter.writeTaskField
  >[1];
  const write = {
    actorId: "actor",
    invokeId: "invoke",
    entryId: "entry",
    field: "Urgency",
    issueNodeId: "I_one",
    projectNodeId: "P_one",
    labels: [],
    repositories: [],
    value: "Normal",
    storage: { kind: "issue-field" as const, organization: "example", name: "Urgency" },
  };
  await f.adapter.writeTaskField(write, issue);
  expect(f.calls.at(-1)?.variables).toEqual({
    input: { issueId: "I_one", issueFields: [{ fieldId: "F_one", singleSelectOptionId: "O_one" }] },
  });
  await f.adapter.writeTaskField(
    { ...write, value: "request", storage: { kind: "issue-type", organization: "example" } },
    issue,
  );
  expect(f.calls.at(-1)?.variables).toEqual({ input: { issueId: "I_one", issueTypeId: "T_one" } });
});

test("malformed organization fields fail before publishing a ready observation", async () => {
  const f = fixture();
  const saved = { ...rawField };
  try {
    rawField.id = "bad id";
    await expect(f.adapter.observeScope(scope)).rejects.toMatchObject({ kind: "transport" });
    rawField.id = saved.id;
    rawField.dataType = "UNSUPPORTED";
    await expect(f.adapter.observeScope(scope)).rejects.toMatchObject({ kind: "transport" });
    rawField.dataType = saved.dataType;
    rawField.options[0]!.color = "UNKNOWN";
    await expect(f.adapter.observeScope(scope)).rejects.toMatchObject({ kind: "transport" });
  } finally {
    Object.assign(rawField, saved);
    rawField.options[0]!.color = "GRAY";
  }
});

test("GitHub's missing schema field response makes organization storage unsupported", async () => {
  const adapter = organizationFields(
    {
      query: async () => {
        throw { errors: [{ message: "Field 'issueFields' doesn't exist on type 'Organization'" }] };
      },
      rest: async <T>() => ({ data: {} as T }),
    },
    () => 42,
  );
  expect(await adapter.observeScope(scope)).toMatchObject({ status: "unsupported" });
});

test("REST update requires the same field in the confirming observation and valid database ids", async () => {
  let databaseId: string | number = 1;
  let optionDatabaseId: string | number = 2;
  const calls: unknown[] = [];
  const adapter = organizationFields(
    {
      query: async <T>(
        _owner: string,
        text: string,
        _variables: Record<string, unknown>,
      ): Promise<T> =>
        text.includes("GitHubIssueFieldIds")
          ? ({
              node: {
                fullDatabaseId: databaseId,
                options: [{ id: "O_one", fullDatabaseId: optionDatabaseId }],
              },
            } as T)
          : ({
              repositoryOwner: {
                __typename: "Organization",
                id: "ORG_one",
                issueFields: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
                issueTypes: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
              },
            } as T),
      rest: async <T>(...args: unknown[]) => {
        calls.push(args);
        return { data: {} as T };
      },
    },
    () => 42,
  );
  const write = {
    kind: "issue-field-update" as const,
    organization: "example",
    nodeId: "F_one",
    options: [{ id: "O_one", name: "Normal", color: "gray" as const, description: "" }],
  };
  await expect(adapter.writeScopeEntity(write)).rejects.toMatchObject({ kind: "missing" });
  expect(calls).toHaveLength(1);
  calls.length = 0;
  databaseId = "invalid";
  await expect(adapter.writeScopeEntity(write)).rejects.toMatchObject({ kind: "transport" });
  expect(calls).toHaveLength(0);
  databaseId = 1;
  optionDatabaseId = 0;
  await expect(adapter.writeScopeEntity(write)).rejects.toMatchObject({ kind: "transport" });
  expect(calls).toHaveLength(0);
});

test("organization scalar writes use the native value input and refuse disabled types and multi-select", async () => {
  const saved = { ...rawField };
  const f = fixture();
  const issue = { issue: { repository: "example/records" } } as Parameters<
    typeof f.adapter.writeTaskField
  >[1];
  const write = {
    actorId: "actor",
    invokeId: "invoke",
    entryId: "entry",
    field: "priority",
    issueNodeId: "I_one",
    projectNodeId: "P_one",
    storage: { kind: "issue-field" as const, organization: "example", name: "Urgency" },
    labels: [],
    repositories: [],
    value: "Sample",
  };
  try {
    for (const [type, value] of [
      ["TEXT", "Sample"],
      ["NUMBER", 3],
      ["DATE", "2026-01-01"],
    ] as const) {
      rawField.dataType = type;
      await f.adapter.writeTaskField({ ...write, value }, issue);
      expect(f.calls.at(-1)?.variables).toEqual({
        input: {
          issueId: "I_one",
          issueFields: [{ fieldId: "F_one", [type.toLowerCase() + "Value"]: value }],
        },
      });
    }
    rawField.dataType = "MULTI_SELECT";
    await expect(f.adapter.writeTaskField(write, issue)).rejects.toMatchObject({
      kind: "unavailable",
    });
    rawType.isEnabled = false;
    await expect(
      f.adapter.writeTaskField(
        { ...write, storage: { kind: "issue-type", organization: "example" }, value: "Request" },
        issue,
      ),
    ).rejects.toMatchObject({ kind: "missing" });
  } finally {
    Object.assign(rawField, saved);
    rawType.isEnabled = true;
  }
});

test("organization create refuses a mutation without its returned entity", async () => {
  const adapter = organizationFields(
    {
      query: async <T>(_owner: string, text: string) =>
        text.includes("GitHubOrganizationId")
          ? ({ organization: { id: "ORG_one" } } as T)
          : ({} as T),
      rest: async <T>() => ({ data: {} as T }),
    },
    () => 42,
  );
  await expect(
    adapter.writeScopeEntity({
      kind: "issue-type-create",
      organization: "example",
      name: "Request",
      color: "blue",
      description: "",
    }),
  ).rejects.toMatchObject({ kind: "rejected" });
});

test("clearing an absent issue field value is repeatable success", async () => {
  const base = fixture();
  const adapter = organizationFields(
    {
      query: async <T>(
        owner: string,
        text: string,
        variables: Record<string, unknown>,
      ): Promise<T> => {
        if (text.includes("deleteIssueFieldValue")) throw { errors: [{ type: "NOT_FOUND" }] };
        return base.api.query<T>(owner, text, variables);
      },
      rest: base.api.rest,
    },
    () => 42,
  );
  const write = {
    actorId: "actor",
    invokeId: "invoke",
    entryId: "entry",
    field: "priority",
    issueNodeId: "I_one",
    projectNodeId: "P_one",
    storage: { kind: "issue-field" as const, organization: "example", name: "Urgency" },
    labels: [],
    repositories: [],
    value: null,
  };
  const issue = { issue: { repository: "example/records" } } as Parameters<
    typeof adapter.writeTaskField
  >[1];
  await expect(adapter.writeTaskField(write, issue)).resolves.toBeUndefined();
  await expect(adapter.writeTaskField(write, issue)).resolves.toBeUndefined();
});
