// ---
// relationships:
//   implements: github-event-source
// ---
import { graphql, GraphqlResponseError } from "@octokit/graphql";
import { request } from "@octokit/request";
import { Ajv2020 } from "ajv/dist/2020.js";
import { githubEventsSchema } from "@wyrd-company/manifold-shared";
import { GitHubSourceError, GitHubWriteError } from "./types.ts";
import type {
  GitHubSourceOptions,
  GitHubIssue,
  GitHubProject,
  ObservedIssue,
  ObservedItem,
  ObservedField,
  GitHubHookConfiguration,
  ProjectField,
  ProjectFieldOption,
  ProjectFieldOptionColor,
  ProjectFieldWrite,
} from "./types.ts";
import { fieldOptionColors, fieldWriteMutation } from "./fields.ts";
import type { RouterClock } from "../router/index.ts";

const fieldConfigurationRef =
  "fragment GitHubFieldConfiguration on ProjectV2FieldConfiguration { ... on ProjectV2FieldCommon { id name dataType isIssueField } ... on ProjectV2SingleSelectField { options { id name color description } } }";
const fieldTypes: Readonly<Record<string, ProjectField["type"]>> = {
  TEXT: "text",
  NUMBER: "number",
  DATE: "date",
  SINGLE_SELECT: "single-select",
  MULTI_SELECT: "multi-select",
  ITERATION: "iteration",
};
interface RawFieldConfiguration {
  id: string;
  name: string;
  dataType: string;
  isIssueField: boolean;
  options?: { id: string; name: string; color: string; description: string | null }[];
}
function fieldOption(raw: {
  id: string;
  name: string;
  color: string;
  description: string | null;
}): ProjectFieldOption {
  const color = raw.color?.toLowerCase() as ProjectFieldOptionColor;
  if (!fieldOptionColors.includes(color) || typeof raw.name !== "string")
    throw new GitHubSourceError("api", "Invalid GitHub field option");
  return {
    id: nodeId(raw.id),
    name: raw.name,
    color,
    description: typeof raw.description === "string" ? raw.description : "",
  };
}
function projectField(raw: RawFieldConfiguration): ProjectField | undefined {
  const type = fieldTypes[raw.dataType];
  if (!type || raw.isIssueField) return undefined;
  if (typeof raw.name !== "string")
    throw new GitHubSourceError("api", "Invalid GitHub field configuration");
  return {
    nodeId: nodeId(raw.id),
    name: raw.name,
    type,
    options:
      type === "single-select" && Array.isArray(raw.options) ? raw.options.map(fieldOption) : [],
  };
}

const issueRef =
  "fragment GitHubIssueRef on Issue { id number title url state stateReason repository { nameWithOwner } }";
const fieldRef =
  "fragment GitHubField on ProjectV2FieldConfiguration { ... on ProjectV2FieldCommon { id name dataType } }";
const fieldValues =
  "nodes { ... on ProjectV2ItemFieldTextValue { text field { ...GitHubField } } ... on ProjectV2ItemFieldNumberValue { number field { ...GitHubField } } ... on ProjectV2ItemFieldDateValue { date field { ...GitHubField } } ... on ProjectV2ItemFieldSingleSelectValue { optionId name field { ...GitHubField } } ... on ProjectV2ItemFieldIterationValue { iterationId title startDate duration field { ...GitHubField } } }";
const pageInfo = "pageInfo { hasNextPage endCursor }";
const itemRef = `fragment GitHubItem on ProjectV2Item { id type isArchived project { id } content { ... on Issue { ...GitHubIssueRef } ... on PullRequest { id } ... on DraftIssue { id } } fieldValues(first: 50) { ${pageInfo} ${fieldValues} } }`;
const itemFragments = `${itemRef} ${fieldRef} ${issueRef}`;
const ajv = new Ajv2020();
ajv.addSchema(githubEventsSchema);
const validators = new Map(
  ["issue", "project", "item", "field", "field-value"].map((name) => [
    name,
    ajv.compile({ $ref: `${githubEventsSchema.$id}#/$defs/${name}` }),
  ]),
);
function validate<T>(name: string, value: T): T {
  if (!validators.get(name)!(value)) throw new GitHubSourceError("api", `Invalid GitHub ${name}`);
  return value;
}
function nodeId(value: string) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_=+/-]{1,200}$/.test(value))
    throw new GitHubSourceError("api", "Invalid GitHub node id");
  return value;
}
interface Connection<T> {
  nodes: T[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}
interface RawIssue {
  title?: string;
  url?: string;
  id: string;
  number: number;
  state: string;
  stateReason: string | null;
  repository: { nameWithOwner: string };
  parent: RawIssue | null;
  blockedBy: Connection<RawIssue>;
  blocking: Connection<RawIssue>;
  subIssues: Connection<RawIssue>;
}
interface RawField {
  field?: { id: string; name: string; dataType: string };
  text: string;
  number: number;
  date: string;
  optionId: string;
  name: string;
  iterationId: string;
  title: string;
  startDate: string;
  duration: number;
}
interface RawItem {
  id: string;
  type: string;
  isArchived: boolean;
  project: { id: string };
  content: RawIssue | { id: string } | null;
  fieldValues: Connection<RawField>;
}
interface RawProject {
  id: string;
  number: number;
  closed: boolean;
  owner: { login: string };
  items: Connection<RawItem>;
}
function issue(raw: RawIssue): GitHubIssue {
  const identity = validate("issue", {
    nodeId: nodeId(raw.id),
    repository: raw.repository.nameWithOwner,
    number: raw.number,
    state: raw.state.toLowerCase() as GitHubIssue["state"],
    stateReason: (raw.stateReason?.toLowerCase() as GitHubIssue["stateReason"]) ?? null,
  });
  if (
    (raw.title !== undefined && typeof raw.title !== "string") ||
    (raw.url !== undefined && (typeof raw.url !== "string" || !/^https?:\/\/[^\s]+$/.test(raw.url)))
  )
    throw new GitHubSourceError("api", "Invalid GitHub issue title or URL");
  return {
    ...identity,
    ...(raw.title !== undefined ? { title: raw.title } : {}),
    ...(raw.url !== undefined ? { url: raw.url } : {}),
  };
}
export function createGitHubApi(options: GitHubSourceOptions, clock: RouterClock) {
  let controller: AbortController | undefined;
  let stopped = false;
  async function call<T>(
    owner: string,
    work: (token: string, signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    if (stopped) throw new GitHubSourceError("api", "GitHub source is stopped");
    const entry = Object.entries(options.configuration.owners).find(
      ([login]) => login.toLowerCase() === owner.toLowerCase(),
    )?.[1];
    if (!entry)
      throw new GitHubSourceError("unconfigured-owner", `GitHub owner is not configured: ${owner}`);
    const active = new AbortController();
    controller = active;
    const abort = () => active.abort(signal?.reason);
    if (signal?.aborted) abort();
    signal?.addEventListener("abort", abort, { once: true });
    const cancel = clock.setTimer(options.configuration.requestTimeoutMs, () => active.abort());
    try {
      if (active.signal.aborted) throw new GitHubSourceError("api", "GitHub request aborted");
      const aborted = new Promise<never>((_resolve, reject) =>
        active.signal.addEventListener(
          "abort",
          () => reject(new GitHubSourceError("api", "GitHub request aborted")),
          { once: true },
        ),
      );
      return await Promise.race([
        aborted,
        (async () => {
          const credential = options.credentials.resolve(entry.credential);
          if (credential.kind !== "github-app")
            throw new GitHubSourceError("api", "Requires github-app credential");
          const token = await credential.installationToken({ signal: active.signal });
          if (active.signal.aborted) throw new GitHubSourceError("api", "GitHub request aborted");
          return work(token.reveal(), active.signal);
        })(),
      ]);
    } catch (error) {
      if (error instanceof GitHubSourceError) throw error;
      const status =
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof error.status === "number"
          ? error.status
          : undefined;
      throw new GitHubSourceError("api", "GitHub request failed", status, error);
    } finally {
      cancel();
      signal?.removeEventListener("abort", abort);
      if (controller === active) controller = undefined;
    }
  }
  async function query<T>(
    owner: string,
    text: string,
    variables: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T> {
    return call(
      owner,
      async (token, signal) => {
        try {
          return await graphql<T>(text, {
            ...variables,
            baseUrl: options.configuration.apiUrl,
            headers: { authorization: `token ${token}` },
            request: { signal },
          });
        } catch (error) {
          if (
            error instanceof GraphqlResponseError &&
            error.errors?.length &&
            error.errors.every((e) => {
              const path = e.path as readonly (string | number)[] | undefined;
              return e.type === "NOT_FOUND" && path?.[0] === "nodes" && typeof path[1] === "number";
            })
          )
            return error.data as T;
          throw error;
        }
      },
      signal,
    );
  }
  async function writeQuery<T>(
    owner: string,
    text: string,
    variables: Record<string, unknown>,
    missing: "field-missing" | "item-missing",
    signal?: AbortSignal,
  ): Promise<T> {
    try {
      return await query<T>(owner, text, variables, signal);
    } catch (error) {
      throw writeError(error, missing);
    }
  }
  async function connection<T>(
    owner: string,
    id: string,
    key: string,
    first: Connection<T>,
    selection: string,
    fragments: string,
  ): Promise<T[]> {
    const values = [...first.nodes];
    let page = first;
    while (page.pageInfo.hasNextPage) {
      if (!page.pageInfo.endCursor)
        throw new GitHubSourceError("api", "GitHub pagination has no cursor");
      const result = await query<{ node: Record<string, Connection<T>> }>(
        owner,
        `query GitHubConnection($id: ID!, $after: String) { node(id: $id) { ... on ${key === "fieldValues" ? "ProjectV2Item" : "Issue"} { ${key}(first: 50, after: $after) { ${pageInfo} ${selection} } } } } ${fragments}`,
        { id, after: page.pageInfo.endCursor },
      );
      const next = result.node[key]!;
      if (next.pageInfo.hasNextPage && next.pageInfo.endCursor === page.pageInfo.endCursor)
        throw new GitHubSourceError("api", "GitHub pagination did not advance");
      page = next;
      values.push(...page.nodes);
    }
    return values;
  }
  async function observedItem(
    owner: string,
    raw: RawItem | null,
  ): Promise<ObservedItem | { redacted: string } | undefined> {
    if (!raw) return undefined;
    if (raw.type === "REDACTED") return { redacted: nodeId(raw.id) };
    if (!raw.content || typeof raw.isArchived !== "boolean")
      throw new GitHubSourceError("api", "Invalid GitHub item content");
    const fields: ObservedField[] = [];
    for (const value of await connection(
      owner,
      raw.id,
      "fieldValues",
      raw.fieldValues,
      fieldValues,
      fieldRef,
    )) {
      const f = value.field;
      if (!f) continue;
      let normalized: ObservedField["value"];
      switch (f.dataType) {
        case "TEXT":
          normalized = { kind: "text", text: value.text };
          break;
        case "NUMBER":
          normalized = { kind: "number", number: value.number };
          break;
        case "DATE":
          normalized = { kind: "date", date: value.date };
          break;
        case "SINGLE_SELECT":
          normalized = { kind: "single-select", optionId: value.optionId, name: value.name };
          break;
        case "ITERATION":
          normalized = {
            kind: "iteration",
            iterationId: value.iterationId,
            title: value.title,
            startDate: value.startDate,
            duration: value.duration,
          };
          break;
        default:
          continue;
      }
      fields.push({
        field: validate("field", { nodeId: nodeId(f.id), name: f.name }),
        value: validate("field-value", normalized),
      });
    }
    return {
      item: validate("item", {
        nodeId: nodeId(raw.id),
        contentType: raw.type
          .toLowerCase()
          .replace("_", "-") as ObservedItem["item"]["contentType"],
        contentNodeId: nodeId(raw.content.id),
      }),
      projectId: nodeId(raw.project.id),
      archived: raw.isArchived,
      issue: raw.type === "ISSUE" ? issue(raw.content as RawIssue) : null,
      fields,
    };
  }
  return {
    abort() {
      stopped = true;
      controller?.abort();
    },
    async projectField(
      owner: string,
      project: string,
      name: string,
      optionName: string,
      signal?: AbortSignal,
    ) {
      const data = await writeQuery<{
        node: {
          field: { id: string; name: string; options: { id: string; name: string }[] } | null;
        } | null;
      }>(
        owner,
        "query GitHubProjectField($id: ID!, $name: String!) { node(id: $id) { ... on ProjectV2 { field(name: $name) { ... on ProjectV2SingleSelectField { id name options { id name } } } } } }",
        { id: project, name },
        "field-missing",
        signal,
      );
      const field = data.node?.field;
      if (!field?.id || field.name !== name || !Array.isArray(field.options))
        throw new GitHubWriteError("field-missing", `Single-select field is absent: ${name}`);
      const option = field.options.find((option) => option.name === optionName);
      if (!option?.id)
        throw new GitHubWriteError(
          "option-missing",
          `Single-select option is absent: ${optionName}`,
        );
      return { field: nodeId(field.id), option: nodeId(option.id) };
    },
    async moveCard(
      owner: string,
      project: string,
      item: string,
      field: string,
      option: string,
      signal?: AbortSignal,
    ) {
      const data = await writeQuery<{
        updateProjectV2ItemFieldValue: { projectV2Item: { id: string } | null } | null;
      }>(
        owner,
        "mutation GitHubCardMove($project: ID!, $item: ID!, $field: ID!, $option: String!) { updateProjectV2ItemFieldValue(input: { projectId: $project, itemId: $item, fieldId: $field, value: { singleSelectOptionId: $option } }) { projectV2Item { id } } }",
        { project, item, field, option },
        "item-missing",
        signal,
      );
      if (data.updateProjectV2ItemFieldValue?.projectV2Item?.id !== item)
        throw new GitHubWriteError("rejected", "GitHub did not confirm the card move");
    },
    async projectFields(project: GitHubProject, signal?: AbortSignal): Promise<ProjectField[]> {
      const fields: ProjectField[] = [];
      let after: string | undefined;
      const seen = new Set<string>();
      do {
        const data = await query<{
          node: {
            fields: Connection<RawFieldConfiguration>;
          } | null;
        }>(
          project.owner,
          `query GitHubProjectFields($id: ID!, $after: String) { node(id: $id) { ... on ProjectV2 { id fields(first: 100, after: $after) { ${pageInfo} nodes { ...GitHubFieldConfiguration } } } } } ${fieldConfigurationRef}`,
          { id: project.nodeId, after: after ?? null },
          signal,
        );
        if (!data.node || !Array.isArray(data.node.fields.nodes))
          throw new GitHubSourceError("api", "Invalid GitHub Project fields");
        for (const raw of data.node.fields.nodes) {
          const field = projectField(raw);
          if (field) fields.push(field);
        }
        const info = data.node.fields.pageInfo;
        if (info.hasNextPage) {
          if (!info.endCursor || seen.has(info.endCursor))
            throw new GitHubSourceError("api", "GitHub Project field pagination did not advance");
          seen.add(info.endCursor);
          after = info.endCursor;
        } else after = undefined;
      } while (after);
      return fields;
    },
    async writeField(
      owner: string,
      write: ProjectFieldWrite,
      signal?: AbortSignal,
    ): Promise<ProjectField | undefined> {
      const { operation, variables } = fieldWriteMutation(write);
      const text = {
        create: `mutation GitHubCreateProjectField($project: ID!, $type: ProjectV2CustomFieldType!, $name: String!, $options: [ProjectV2SingleSelectFieldOptionInput!]) { createProjectV2Field(input: { projectId: $project, dataType: $type, name: $name, singleSelectOptions: $options }) { projectV2Field { ...GitHubFieldConfiguration } } } ${fieldConfigurationRef}`,
        update: `mutation GitHubUpdateProjectField($field: ID!, $name: String, $options: [ProjectV2SingleSelectFieldOptionInput!]) { updateProjectV2Field(input: { fieldId: $field, name: $name, singleSelectOptions: $options }) { projectV2Field { ...GitHubFieldConfiguration } } } ${fieldConfigurationRef}`,
        delete: `mutation GitHubDeleteProjectField($field: ID!) { deleteProjectV2Field(input: { fieldId: $field }) { projectV2Field { ... on ProjectV2FieldCommon { id } } } }`,
      }[operation];
      const data = await writeQuery<{
        createProjectV2Field?: { projectV2Field: RawFieldConfiguration | null } | null;
        updateProjectV2Field?: { projectV2Field: RawFieldConfiguration | null } | null;
        deleteProjectV2Field?: { projectV2Field: { id: string } | null } | null;
      }>(owner, text, variables, "field-missing", signal);
      if (operation === "delete") {
        if (!data.deleteProjectV2Field?.projectV2Field?.id)
          throw new GitHubWriteError("rejected", "GitHub did not confirm the field delete");
        return undefined;
      }
      const raw = (operation === "create" ? data.createProjectV2Field : data.updateProjectV2Field)
        ?.projectV2Field;
      if (!raw?.id) throw new GitHubWriteError("rejected", "GitHub did not return the field");
      const field = projectField(raw);
      if (!field) throw new GitHubWriteError("rejected", "GitHub returned an unsupported field");
      return field;
    },
    async resolveProject(owner: string, number: number) {
      const data = await query<{ repositoryOwner: { projectV2: RawProject | null } | null }>(
        owner,
        "query GitHubProjectByNumber($login: String!, $number: Int!) { repositoryOwner(login: $login) { ... on ProjectV2Owner { projectV2(number: $number) { id number closed owner { ... on Organization { login } ... on User { login } } } } } }",
        { login: owner, number },
      );
      const raw = data.repositoryOwner?.projectV2;
      if (!raw)
        throw new GitHubSourceError(
          "unresolved-project",
          `GitHub Project not found: ${owner}/${number}`,
        );
      if (typeof raw.closed !== "boolean")
        throw new GitHubSourceError("api", "Invalid GitHub Project state");
      return {
        project: validate("project", {
          nodeId: nodeId(raw.id),
          owner: raw.owner.login,
          number: raw.number,
        }),
        closed: raw.closed,
      };
    },
    async projectPage(project: GitHubProject, after?: string) {
      const data = await query<{ node: RawProject }>(
        project.owner,
        `query GitHubProject($id: ID!, $after: String) { node(id: $id) { ... on ProjectV2 { id number closed items(first: 100, after: $after) { ${pageInfo} nodes { ...GitHubItem } } } } } ${itemFragments}`,
        { id: project.nodeId, after: after ?? null },
      );
      if (!data.node || typeof data.node.closed !== "boolean")
        throw new GitHubSourceError("api", "Invalid GitHub Project");
      const items: ObservedItem[] = [];
      for (const raw of data.node.items.nodes) {
        const item = await observedItem(project.owner, raw);
        if (item && "item" in item) items.push(item);
      }
      return {
        closed: data.node.closed,
        items,
        seenIds: data.node.items.nodes.map((raw) => nodeId(raw.id)),
        pageInfo: data.node.items.pageInfo,
      };
    },
    async items(owner: string, ids: readonly string[]) {
      const data = await query<{ nodes: (RawItem | null)[] }>(
        owner,
        `query GitHubItems($ids: [ID!]!) { nodes(ids: $ids) { ...GitHubItem } } ${itemFragments}`,
        { ids },
      );
      if (!Array.isArray(data.nodes) || data.nodes.length !== ids.length)
        throw new GitHubSourceError("api", "Invalid GitHub item response");
      const values = [];
      for (const raw of data.nodes) values.push(await observedItem(owner, raw));
      return values;
    },
    async issues(owner: string, ids: readonly string[]) {
      const data = await query<{ nodes: (RawIssue | null)[] }>(
        owner,
        `query GitHubIssues($ids: [ID!]!) { nodes(ids: $ids) { ... on Issue { ...GitHubIssueRef parent { ...GitHubIssueRef } blockedBy(first: 50) { ${pageInfo} nodes { ...GitHubIssueRef } } blocking(first: 50) { ${pageInfo} nodes { ...GitHubIssueRef } } subIssues(first: 50) { ${pageInfo} nodes { ...GitHubIssueRef } } } } } ${issueRef}`,
        { ids },
      );
      if (!Array.isArray(data.nodes) || data.nodes.length !== ids.length)
        throw new GitHubSourceError("api", "Invalid GitHub issue response");
      const values: ObservedIssue[] = [];
      for (const raw of data.nodes) {
        if (!raw) continue;
        const lists = [];
        for (const key of ["blockedBy", "blocking", "subIssues"] as const)
          lists.push(
            (
              await connection(
                owner,
                raw.id,
                key,
                raw[key],
                "nodes { ...GitHubIssueRef }",
                issueRef,
              )
            ).map(issue),
          );
        values.push({
          issue: issue(raw),
          blockedBy: lists[0]!,
          blocking: lists[1]!,
          subIssues: lists[2]!,
          parent: raw.parent ? issue(raw.parent) : undefined,
        });
      }
      return values;
    },
    async deliveries(owner: string, hook: GitHubHookConfiguration, cursor?: string) {
      return call(owner, async (token, signal) => {
        const { data, headers } = await request(
          `GET ${hook.repository ? "/repos/{owner}/{repo}" : "/orgs/{org}"}/hooks/{hook_id}/deliveries`,
          {
            baseUrl: options.configuration.apiUrl,
            ...(hook.repository ? { owner, repo: hook.repository } : { org: owner }),
            hook_id: hook.id,
            per_page: 100,
            ...(cursor ? { cursor } : {}),
            headers: { authorization: `token ${token}` },
            request: { signal },
          },
        );
        const next = headers.link?.split(",").find((link) => /;\s*rel="next"/.test(link));
        const nextUrl = next?.match(/<([^>]+)>/)?.[1];
        const nextCursor = nextUrl ? new URL(nextUrl).searchParams.get("cursor") : undefined;
        if (next && !nextCursor)
          throw new GitHubSourceError("api", "GitHub delivery pagination has no cursor");
        return { attempts: hookAttempts(data), nextCursor: nextCursor ?? undefined };
      });
    },
    async redeliver(owner: string, hook: GitHubHookConfiguration, attempt: number | bigint) {
      await call(owner, async (token, signal) =>
        request(
          `POST ${hook.repository ? "/repos/{owner}/{repo}" : "/orgs/{org}"}/hooks/{hook_id}/deliveries/${attempt}/attempts`,
          {
            baseUrl: options.configuration.apiUrl,
            ...(hook.repository ? { owner, repo: hook.repository } : { org: owner }),
            hook_id: hook.id,
            headers: { authorization: `token ${token}` },
            request: { signal },
          },
        ),
      );
    },
  };
}

interface HookAttempt {
  id: number | bigint;
  guid: string;
  delivered_at: string;
  status_code: number;
}
function hookAttempts(value: unknown): HookAttempt[] {
  if (!Array.isArray(value)) throw new GitHubSourceError("api", "Invalid GitHub delivery list");
  return value.map((entry: unknown) => {
    if (typeof entry !== "object" || entry === null)
      throw new GitHubSourceError("api", "Invalid GitHub delivery attempt");
    const row = entry as Record<string, unknown>;
    const id = row["id"];
    if (
      (typeof id !== "number" && typeof id !== "bigint") ||
      (typeof id === "number" && !Number.isSafeInteger(id)) ||
      id <= 0 ||
      typeof row["guid"] !== "string" ||
      !row["guid"] ||
      typeof row["delivered_at"] !== "string" ||
      !Number.isFinite(Date.parse(row["delivered_at"])) ||
      typeof row["status_code"] !== "number" ||
      !Number.isInteger(row["status_code"])
    )
      throw new GitHubSourceError("api", "Invalid GitHub delivery attempt");
    return {
      id,
      guid: row["guid"],
      delivered_at: row["delivered_at"],
      status_code: row["status_code"],
    };
  });
}

export function classifyWriteError(error: unknown): GitHubWriteError {
  return writeError(error, "field-missing");
}
function writeError(error: unknown, missing: "field-missing" | "item-missing"): GitHubWriteError {
  if (error instanceof GitHubWriteError) return error;
  const source = error instanceof GitHubSourceError ? error : undefined;
  const cause = source?.cause ?? error;
  const status = source?.status;
  const graphql = cause instanceof GraphqlResponseError ? cause : undefined;
  const types = graphql?.errors?.map((error) => error.type) ?? [];
  const message =
    graphql?.errors?.map((error) => error.message).join("; ") ||
    (error instanceof Error ? error.message : "GitHub write failed");
  if (
    source?.kind === "unconfigured-owner" ||
    status === 401 ||
    status === 403 ||
    types.includes("FORBIDDEN")
  )
    return new GitHubWriteError("forbidden", message, status);
  if (
    status === 429 ||
    (status !== undefined && status >= 500) ||
    types.includes("RATE_LIMITED") ||
    types.includes("RATE_LIMIT")
  )
    return new GitHubWriteError("transport", message, status);
  if (types.includes("NOT_FOUND")) return new GitHubWriteError(missing, message, status);
  if (graphql || (status !== undefined && status >= 400))
    return new GitHubWriteError("rejected", message, status);
  return new GitHubWriteError("transport", message, status);
}
