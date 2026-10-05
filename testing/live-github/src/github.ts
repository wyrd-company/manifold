// ---
// relationships:
//   implements: live-github-environment
// ---
import { request } from "@octokit/request";
import { graphql } from "@octokit/graphql";
import { createAppAuth } from "@octokit/auth-app";
import { readApp, readCredential } from "./settings.ts";
import type { Settings } from "./settings.ts";
export type Repository = {
  id: number;
  node_id: string;
  name: string;
  description: string | null;
  private: boolean;
  default_branch: string;
};
export type Issue = {
  id: number;
  node_id: string;
  number: number;
  title: string;
  body: string | null;
  pull_request?: unknown;
};
export type Hook = {
  id: number;
  active: boolean;
  events: string[];
  config: {
    url: string;
    content_type?: string;
    insecure_ssl?: string;
    secret?: string;
  };
};
export type Project = { id: string; title: string; number: number };
export type GitHubPort = Pick<GitHub, "rest" | "graph" | "listHooks" | "hook" | "updateHook">;
function failure(operation: string, error: unknown): Error {
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
      ? String(error.status)
      : "unavailable";
  return Error(`${operation} failed (${status})`);
}
export class GitHub {
  readonly organization: string;
  private requestClient;
  private graphClient;
  constructor(organization: string, pat: string) {
    this.organization = organization;
    this.requestClient = request.defaults({
      headers: {
        authorization: `token ${pat}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    this.graphClient = graphql.defaults({
      headers: { authorization: `token ${pat}` },
    });
  }
  async rest<T>(
    operation: string,
    route: string,
    parameters: Record<string, unknown> = {},
  ): Promise<T> {
    try {
      return (
        await this.requestClient(route, {
          ...(route.includes("{org}") ? { org: this.organization } : {}),
          ...(route.includes("{owner}") ? { owner: this.organization } : {}),
          ...parameters,
        })
      ).data as T;
    } catch (error) {
      throw failure(operation, error);
    }
  }
  async graph<T>(
    operation: string,
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<T> {
    try {
      return await this.graphClient<T>(query, variables);
    } catch (error) {
      throw failure(operation, error);
    }
  }
  async preflight(teardown = false) {
    let headers: Record<string, string | number | undefined>;
    try {
      headers = (await this.requestClient("GET /user")).headers;
    } catch (error) {
      throw failure("PAT authentication", error);
    }
    const scopes = headers["x-oauth-scopes"];
    if (scopes !== undefined) {
      const actual = new Set(
        String(scopes)
          .split(",")
          .map((x) => x.trim()),
      );
      for (const required of [
        "repo",
        "project",
        "admin:org_hook",
        ...(teardown ? ["delete_repo"] : []),
      ])
        if (!actual.has(required)) throw Error(`PAT missing scope ${required}`);
    }
    await this.rest("organization lookup", "GET /orgs/{org}");
  }
  async deliveries<T>(id: number): Promise<T[]> {
    const all: T[] = [];
    let cursor: string | undefined;
    try {
      do {
        const response = await this.requestClient("GET /orgs/{org}/hooks/{hook_id}/deliveries", {
          org: this.organization,
          hook_id: id,
          per_page: 100,
          ...(cursor ? { cursor } : {}),
        });
        all.push(...(response.data as T[]));
        const next = /<([^>]+)>;\s*rel="next"/.exec(String(response.headers.link ?? ""));
        cursor = next ? (new URL(next[1]!).searchParams.get("cursor") ?? undefined) : undefined;
      } while (cursor);
      return all;
    } catch (error) {
      throw failure("read hook deliveries", error);
    }
  }
  async listHooks() {
    const all: Hook[] = [];
    for (let page = 1; ; page++) {
      const rows = await this.rest<Hook[]>("list organization hooks", "GET /orgs/{org}/hooks", {
        per_page: 100,
        page,
      });
      all.push(...rows);
      if (rows.length < 100) return all;
    }
  }
  hook(id: number) {
    return this.rest<Hook>("read organization hook", "GET /orgs/{org}/hooks/{hook_id}", {
      hook_id: id,
    });
  }
  updateHook(id: number, patch: Record<string, unknown>) {
    return this.rest<Hook>("update organization hook", "PATCH /orgs/{org}/hooks/{hook_id}", {
      hook_id: id,
      ...patch,
    });
  }
  createIssue(repo: string, title: string, body: string) {
    return this.rest<Issue>("create issue", "POST /repos/{owner}/{repo}/issues", {
      repo,
      title,
      body,
    });
  }
  async addItem(projectId: string, contentId: string) {
    return this.graph<{ addProjectV2ItemById: { item: { id: string } } }>(
      "add project item",
      "mutation($projectId:ID!,$contentId:ID!){addProjectV2ItemById(input:{projectId:$projectId,contentId:$contentId}){item{id}}}",
      { projectId, contentId },
    );
  }
}
export async function installationAccess(settings: Settings) {
  const app = await readApp(settings);
  const privateKey = await readCredential(settings.credentials.appPrivateKeyFile);
  let token: string;
  try {
    token = (
      await createAppAuth({ ...app, privateKey })({
        type: "installation",
        installationId: app.installationId,
      })
    ).token;
  } catch (error) {
    throw failure("App installation authentication", error);
  }
  const client = request.defaults({
    headers: { authorization: `token ${token}` },
  });
  const names = new Set<string>();
  try {
    for (let page = 1; ; page++) {
      const { data } = await client("GET /installation/repositories", {
        per_page: 100,
        page,
      });
      for (const repo of data.repositories) names.add(repo.full_name.toLowerCase());
      if (data.repositories.length < 100) break;
    }
  } catch (error) {
    throw failure("App installation repositories", error);
  }
  for (const name of [settings.repository, settings.processRepository])
    if (!names.has(`${settings.organization}/${name}`.toLowerCase()))
      throw Error(`App installation missing repository access: ${settings.organization}/${name}`);
}
