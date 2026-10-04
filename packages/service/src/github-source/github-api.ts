// ---
// relationships:
//   implements: github-event-source
// ---
import { graphql, GraphqlResponseError } from "@octokit/graphql";
import { request } from "@octokit/request";
import { Ajv2020 } from "ajv/dist/2020.js";
import { githubEventsSchema } from "@wyrd-company/manifold-shared";
import { GitHubSourceError } from "./types.ts";
import type {
  GitHubSourceOptions,
  GitHubIssue,
  GitHubProject,
  ObservedIssue,
  ObservedItem,
  ObservedField,
  GitHubHookConfiguration,
} from "./types.ts";
import type { RouterClock } from "../router/index.ts";

const issueRef =
  "fragment GitHubIssueRef on Issue { id number state stateReason repository { nameWithOwner } }";
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
  return validate("issue", {
    nodeId: nodeId(raw.id),
    repository: raw.repository.nameWithOwner,
    number: raw.number,
    state: raw.state.toLowerCase() as GitHubIssue["state"],
    stateReason: (raw.stateReason?.toLowerCase() as GitHubIssue["stateReason"]) ?? null,
  });
}
export function createGitHubApi(options: GitHubSourceOptions, clock: RouterClock) {
  let controller: AbortController | undefined;
  let stopped = false;
  async function call<T>(
    owner: string,
    work: (token: string, signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (stopped) throw new GitHubSourceError("api", "GitHub source is stopped");
    const entry = Object.entries(options.configuration.owners).find(
      ([login]) => login.toLowerCase() === owner.toLowerCase(),
    )?.[1];
    if (!entry)
      throw new GitHubSourceError("unconfigured-owner", `GitHub owner is not configured: ${owner}`);
    const active = new AbortController();
    controller = active;
    const cancel = clock.setTimer(options.configuration.requestTimeoutMs, () => active.abort());
    try {
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
          const token = await options.credentials
            .resolve(entry.credential)
            .installationToken({ signal: active.signal });
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
      if (controller === active) controller = undefined;
    }
  }
  async function query<T>(
    owner: string,
    text: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    return call(owner, async (token, signal) => {
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
    });
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
    async deliveries(owner: string, hook: GitHubHookConfiguration, page: number) {
      return call(owner, async (token, signal) => {
        const { data } = await request(
          `GET ${hook.repository ? "/repos/{owner}/{repo}" : "/orgs/{org}"}/hooks/{hook_id}/deliveries`,
          {
            baseUrl: options.configuration.apiUrl,
            owner,
            org: owner,
            repo: hook.repository,
            hook_id: hook.id,
            per_page: 100,
            page,
            headers: { authorization: `token ${token}` },
            request: { signal },
          },
        );
        return hookAttempts(data);
      });
    },
    async redeliver(owner: string, hook: GitHubHookConfiguration, attempt: number) {
      await call(owner, async (token, signal) =>
        request(
          `POST ${hook.repository ? "/repos/{owner}/{repo}" : "/orgs/{org}"}/hooks/{hook_id}/deliveries/{delivery_id}/attempts`,
          {
            baseUrl: options.configuration.apiUrl,
            owner,
            org: owner,
            repo: hook.repository,
            hook_id: hook.id,
            delivery_id: attempt,
            headers: { authorization: `token ${token}` },
            request: { signal },
          },
        ),
      );
    },
  };
}

interface HookAttempt {
  id: number;
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
    if (
      typeof row["id"] !== "number" ||
      !Number.isSafeInteger(row["id"]) ||
      row["id"] <= 0 ||
      typeof row["guid"] !== "string" ||
      !row["guid"] ||
      typeof row["delivered_at"] !== "string" ||
      !Number.isFinite(Date.parse(row["delivered_at"])) ||
      typeof row["status_code"] !== "number" ||
      !Number.isInteger(row["status_code"])
    )
      throw new GitHubSourceError("api", "Invalid GitHub delivery attempt");
    return {
      id: row["id"],
      guid: row["guid"],
      delivered_at: row["delivered_at"],
      status_code: row["status_code"],
    };
  });
}
