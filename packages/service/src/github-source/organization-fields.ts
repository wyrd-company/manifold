// ---
// relationships:
//   implements: github-event-source
// ---
import type { StorageScope } from "@wyrd-company/manifold-shared";
import { classifyWriteError } from "./github-api.ts";
import { GitHubSourceError, GitHubWriteError } from "./types.ts";
import type {
  IssueFieldConfiguration,
  IssueTypeConfiguration,
  ScopeConfiguration,
  ScopeEntityWrite,
  TaskFieldWrite,
  TrackedIssue,
} from "./types.ts";

type OrganizationWrite = Extract<ScopeEntityWrite, { organization: string }>;
interface Api {
  query<T>(
    owner: string,
    text: string,
    variables: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T>;
  rest<T>(
    owner: string,
    route: string,
    parameters: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<{ data: T }>;
}
interface Page<T> {
  nodes: T[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}
interface RawField {
  id: string;
  name: string;
  dataType: string;
  options?: { id: string; name: string; color: string; description: string | null }[];
}
interface RawType {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  isEnabled: boolean;
}
const fieldSelection =
  "... on Node { id } ... on IssueFieldCommon { name dataType } ... on IssueFieldSingleSelect { options { id name color description } }";
const typeSelection = "id name color description isEnabled";
const pageInfo = "pageInfo { hasNextPage endCursor }";
const types = {
  TEXT: "text",
  NUMBER: "number",
  DATE: "date",
  SINGLE_SELECT: "single-select",
  MULTI_SELECT: "multi-select",
} as const;
function id(value: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_=+/-]{1,200}$/.test(value))
    throw new GitHubWriteError("transport", "Invalid organization node id");
  return value;
}
function color(value: string): IssueTypeConfiguration["color"] {
  const normalized = value?.toLowerCase();
  if (!/^(gray|blue|green|yellow|orange|red|pink|purple)$/.test(normalized))
    throw new GitHubWriteError("transport", "Invalid organization color");
  return normalized as Exclude<IssueTypeConfiguration["color"], null>;
}
function field(raw: RawField): IssueFieldConfiguration {
  const type = types[raw.dataType as keyof typeof types];
  if (
    !type ||
    typeof raw.name !== "string" ||
    (type === "single-select" && !Array.isArray(raw.options))
  )
    throw new GitHubWriteError("transport", "Invalid issue field");
  return {
    nodeId: id(raw.id),
    name: raw.name,
    type,
    options:
      type === "single-select"
        ? raw.options!.map((option) => ({
            id: id(option.id),
            name: option.name,
            color: color(option.color)!,
            description: option.description ?? "",
          }))
        : [],
  };
}
function issueType(raw: RawType): IssueTypeConfiguration {
  if (typeof raw.name !== "string" || typeof raw.isEnabled !== "boolean")
    throw new GitHubWriteError("transport", "Invalid issue type");
  return {
    nodeId: id(raw.id),
    name: raw.name,
    color: raw.color === null ? null : color(raw.color),
    description: raw.description ?? "",
    enabled: raw.isEnabled,
  };
}
function errors(error: unknown): readonly { type?: string; message?: string }[] {
  if (error instanceof GitHubSourceError) return errors(error.cause);
  if (
    typeof error === "object" &&
    error !== null &&
    "errors" in error &&
    Array.isArray(error.errors)
  )
    return error.errors;
  return [];
}
export function organizationFields(
  api: Api,
  now: () => number,
  cachedScope?: (scope: StorageScope) => ScopeConfiguration | undefined,
) {
  async function observeScope(
    scope: Extract<StorageScope, { kind: "organization" }>,
    signal?: AbortSignal,
  ): Promise<ScopeConfiguration> {
    const failed = (
      status: "unsupported" | "missing" | "forbidden",
      message: string,
    ): ScopeConfiguration => ({ scope, status, message, readAt: now() });
    try {
      const data = await api.query<{
        repositoryOwner: {
          __typename: string;
          id: string;
          issueFields: Page<RawField>;
          issueTypes: Page<RawType>;
        } | null;
      }>(
        scope.organization,
        `query GitHubOrganizationFields($login:String!){repositoryOwner(login:$login){__typename id ... on Organization {issueFields(first:100){${pageInfo} nodes{${fieldSelection}}} issueTypes(first:100){${pageInfo} nodes{${typeSelection}}}}}}`,
        { login: scope.organization },
        signal,
      );
      const owner = data.repositoryOwner;
      if (!owner) return failed("missing", "Organization does not exist");
      if (owner.__typename !== "Organization")
        return failed("unsupported", "Issue fields and issue types require an organization");
      async function pages<T>(
        key: "issueFields" | "issueTypes",
        first: Page<T>,
        selection: string,
      ): Promise<T[]> {
        const values = [...first.nodes];
        let page = first;
        const seen = new Set<string>();
        while (page.pageInfo.hasNextPage) {
          const after = page.pageInfo.endCursor;
          if (!after || seen.has(after))
            throw new GitHubWriteError("transport", "Organization pagination did not advance");
          seen.add(after);
          const next = await api.query<{ organization: Record<string, Page<T>> }>(
            scope.organization,
            `query GitHubOrganizationPage($login:String!,$after:String){organization(login:$login){${key}(first:100,after:$after){${pageInfo} nodes{${selection}}}}}`,
            { login: scope.organization, after },
            signal,
          );
          page = next.organization[key]!;
          values.push(...page.nodes);
        }
        return values;
      }
      const fields = await pages("issueFields", owner.issueFields, fieldSelection);
      const issueTypes = await pages("issueTypes", owner.issueTypes, typeSelection);
      return {
        scope,
        status: "ready",
        readAt: now(),
        issueFields: fields.map(field),
        issueTypes: issueTypes.map(issueType),
        labels: [],
        milestones: [],
      };
    } catch (error) {
      const classified = classifyWriteError(error);
      if (classified.kind === "forbidden") return failed("forbidden", classified.message);
      if (
        errors(error).some((e) =>
          /(?:Cannot query field.*(?:issueFields|issueTypes)|Field ['"](?:issueFields|issueTypes)['"] doesn't exist)/.test(
            e.message ?? "",
          ),
        )
      )
        return failed(
          "unsupported",
          "GitHub does not support organization issue fields or issue types",
        );
      if (errors(error).some((e) => e.type === "NOT_FOUND"))
        return failed("missing", "Organization does not exist");
      throw classified;
    }
  }
  async function ready(organization: string, signal?: AbortSignal) {
    const observed = await observeScope({ kind: "organization", organization }, signal);
    if (observed.status !== "ready") throw new GitHubWriteError("unavailable", observed.message);
    return observed;
  }
  async function writeScopeEntity(write: OrganizationWrite, signal?: AbortSignal) {
    try {
      let operation: string;
      let input: Record<string, unknown>;
      let selection: string;
      if (write.kind === "issue-field-update") {
        // REST preserves option identity. GraphQL's option input has no id.
        const data = await api.query<{
          node: {
            fullDatabaseId: string | number;
            options?: { id: string; fullDatabaseId: string | number }[];
          } | null;
        }>(
          write.organization,
          "query GitHubIssueFieldIds($id:ID!){node(id:$id){... on IssueFieldCommon { ... on IssueFieldText {fullDatabaseId} ... on IssueFieldNumber {fullDatabaseId} ... on IssueFieldDate {fullDatabaseId} ... on IssueFieldSingleSelect {fullDatabaseId options{id fullDatabaseId}}}}}",
          { id: write.nodeId },
          signal,
        );
        if (!data.node) throw new GitHubWriteError("missing", "Issue field is absent");
        const databaseId = (value: string | number | undefined) => {
          const number = Number(value);
          if (!Number.isSafeInteger(number) || number <= 0)
            throw new GitHubWriteError("transport", "Invalid issue field database id");
          return number;
        };
        await api.rest(
          write.organization,
          "PATCH /orgs/{org}/issue-fields/{issue_field_id}",
          {
            org: write.organization,
            issue_field_id: databaseId(data.node.fullDatabaseId),
            ...(write.name !== undefined ? { name: write.name } : {}),
            ...(write.options
              ? {
                  options: write.options.map((option, priority) => ({
                    name: option.name,
                    color: option.color,
                    description: option.description,
                    priority,
                    ...(option.id
                      ? {
                          id: databaseId(
                            data.node!.options?.find((o) => o.id === option.id)?.fullDatabaseId,
                          ),
                        }
                      : {}),
                  })),
                }
              : {}),
          },
          signal,
        );
        const updated = (await ready(write.organization, signal)).issueFields.find(
          (f) => f.nodeId === write.nodeId,
        );
        if (!updated) throw new GitHubWriteError("missing", "Updated issue field is absent");
        return updated;
      }
      if (write.kind === "issue-field-delete") {
        await api.query(
          write.organization,
          "mutation GitHubDeleteIssueField($input:DeleteIssueFieldInput!){deleteIssueField(input:$input){clientMutationId}}",
          { input: { fieldId: write.nodeId } },
          signal,
        );
        return;
      }
      if (write.kind === "issue-field-create" || write.kind === "issue-type-create") {
        const owner = await api.query<{ organization: { id: string } | null }>(
          write.organization,
          "query GitHubOrganizationId($login:String!){organization(login:$login){id}}",
          { login: write.organization },
          signal,
        );
        if (!owner.organization) throw new GitHubWriteError("missing", "Organization is absent");
        input = { ownerId: id(owner.organization.id), name: write.name };
        if (write.kind === "issue-field-create") {
          operation = "createIssueField";
          input["dataType"] = write.type.replaceAll("-", "_").toUpperCase();
          if (write.options)
            input["options"] = write.options.map((option, priority) => ({
              name: option.name,
              color: option.color.toUpperCase(),
              description: option.description,
              priority,
            }));
          selection = `issueField{${fieldSelection}}`;
        } else {
          operation = "createIssueType";
          Object.assign(input, {
            color: write.color.toUpperCase(),
            description: write.description,
            isEnabled: true,
          });
          selection = `issueType{${typeSelection}}`;
        }
      } else {
        operation = "updateIssueType";
        input = {
          issueTypeId: write.nodeId,
          ...(write.name !== undefined ? { name: write.name } : {}),
          ...(write.color !== undefined ? { color: write.color.toUpperCase() } : {}),
          ...(write.description !== undefined ? { description: write.description } : {}),
          ...(write.enabled !== undefined ? { isEnabled: write.enabled } : {}),
        };
        selection = `issueType{${typeSelection}}`;
      }
      const data = await api.query<Record<string, { issueField?: RawField; issueType?: RawType }>>(
        write.organization,
        `mutation GitHubOrganizationWrite($input:${operation[0]!.toUpperCase() + operation.slice(1)}Input!){${operation}(input:$input){${selection}}}`,
        { input },
        signal,
      );
      const result = data[operation];
      if (result?.issueField) return field(result.issueField);
      if (result?.issueType) return issueType(result.issueType);
      throw new GitHubWriteError("rejected", "GitHub did not return the organization entity");
    } catch (error) {
      const classified = classifyWriteError(error);
      throw classified.kind === "field-missing"
        ? new GitHubWriteError("missing", classified.message, classified.status)
        : classified;
    }
  }
  async function writeTaskField(write: TaskFieldWrite, issue: TrackedIssue, signal?: AbortSignal) {
    const storage = write.storage;
    if (storage.kind !== "issue-field" && storage.kind !== "issue-type")
      throw new TypeError("Organization adapter received another storage kind");
    if (issue.issue.repository.split("/")[0]!.toLowerCase() !== storage.organization.toLowerCase())
      throw new GitHubWriteError("out-of-scope", "Issue belongs to another organization");
    if (
      cachedScope &&
      cachedScope({ kind: "organization", organization: storage.organization })?.status !== "ready"
    )
      throw new GitHubWriteError("unavailable", "Organization configuration is unavailable");
    const observed = await ready(storage.organization, signal);
    let operation: string;
    let input: Record<string, unknown>;
    if (storage.kind === "issue-type") {
      const type =
        write.value === null
          ? undefined
          : observed.issueTypes.find(
              (type) =>
                type.name.toLowerCase() === String(write.value).toLowerCase() && type.enabled,
            );
      if (write.value !== null && !type)
        throw new GitHubWriteError("missing", "Issue type is absent or disabled");
      operation = "updateIssueIssueType";
      input = { issueId: write.issueNodeId, issueTypeId: type?.nodeId ?? null };
    } else {
      const field = observed.issueFields.find((field) => field.name === storage.name);
      if (!field) throw new GitHubWriteError("missing", "Issue field is absent");
      if (field.type === "multi-select")
        throw new GitHubWriteError("unavailable", "Multi-select fields are unsupported");
      operation = write.value === null ? "deleteIssueFieldValue" : "setIssueFieldValue";
      if (write.value === null) input = { issueId: write.issueNodeId, fieldId: field.nodeId };
      else {
        const option =
          field.type === "single-select"
            ? field.options.find((option) => option.name === write.value)
            : undefined;
        if (field.type === "single-select" && !option)
          throw new GitHubWriteError("missing", "Issue field option is absent");
        input = {
          issueId: write.issueNodeId,
          issueFields: [
            {
              fieldId: field.nodeId,
              ...(option
                ? { singleSelectOptionId: option.id }
                : { [`${field.type}Value`]: write.value }),
            },
          ],
        };
      }
    }
    try {
      await api.query(
        storage.organization,
        `mutation GitHubOrganizationValue($input:${operation[0]!.toUpperCase() + operation.slice(1)}Input!){${operation}(input:$input){clientMutationId}}`,
        { input },
        signal,
      );
    } catch (error) {
      if (
        operation === "deleteIssueFieldValue" &&
        errors(error).some((e) => e.type === "NOT_FOUND")
      )
        return;
      throw classifyWriteError(error);
    }
  }
  return { observeScope, writeScopeEntity, writeTaskField };
}
