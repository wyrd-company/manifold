// ---
// relationships:
//   verifies: live-github-environment
// ---
import { createHash } from "node:crypto";
import type { GitHubPort, Hook, Repository, Issue, Project } from "./github.ts";
export function recordedGitHub() {
  const repositories = new Map<string, Repository>(),
    issues = new Map<string, Issue>(),
    projects = new Map<string, Project>(),
    hooks = new Map<number, Hook>(),
    items = new Set<string>();
  const trees = new Map<string, { path: string; mode: string; type: string; sha: string }[]>(),
    commits = new Map<string, { tree: { sha: string } }>(),
    heads = new Map<string, string>();
  const calls: { op: string; write: boolean }[] = [];
  let id = 1;
  const record = (op: string, write: boolean) => calls.push({ op, write });
  const digest = (s: string) => createHash("sha1").update(s).digest("hex");
  const blob = (s: string) => digest(`blob ${Buffer.byteLength(s)}\0${s}`);
  const api: GitHubPort = {
    async rest<T>(op: string, route: string, params: Record<string, unknown> = {}) {
      record(op, !route.startsWith("GET "));
      let result: unknown;
      switch (route) {
        case "GET /orgs/{org}/repos":
          result = [...repositories.values()];
          break;
        case "POST /orgs/{org}/repos": {
          const repo: Repository = {
            id: id++,
            node_id: `R${id}`,
            name: String(params["name"]),
            description: String(params["description"]),
            private: Boolean(params["private"]),
            default_branch: "main",
          };
          repositories.set(repo.name, repo);
          trees.set("initial", [
            { path: "README.md", mode: "100644", type: "blob", sha: blob("initial") },
          ]);
          commits.set("initial-commit", { tree: { sha: "initial" } });
          heads.set(repo.name, "initial-commit");
          result = repo;
          break;
        }
        case "GET /repos/{owner}/{repo}/issues":
          result = [...issues.values()];
          break;
        case "POST /repos/{owner}/{repo}/issues": {
          const issue: Issue = {
            id: id++,
            node_id: `I${id}`,
            number: issues.size + 1,
            title: String(params["title"]),
            body: String(params["body"]),
          };
          issues.set(issue.node_id, issue);
          result = issue;
          break;
        }
        case "GET /repos/{owner}/{repo}/git/ref/{ref}":
          result = { object: { sha: heads.get(String(params["repo"])) } };
          break;
        case "GET /repos/{owner}/{repo}/git/commits/{commit_sha}":
          result = commits.get(String(params["commit_sha"]));
          break;
        case "GET /repos/{owner}/{repo}/git/trees/{tree_sha}":
          result = { tree: trees.get(String(params["tree_sha"])) };
          break;
        case "POST /repos/{owner}/{repo}/git/trees": {
          const entries = (
            params["tree"] as { path: string; content: string; mode: string; type: string }[]
          ).map((e) => ({ path: e.path, mode: e.mode, type: e.type, sha: blob(e.content) }));
          const sha = digest(JSON.stringify(entries));
          trees.set(sha, entries);
          result = { sha };
          break;
        }
        case "POST /repos/{owner}/{repo}/git/commits": {
          const sha = digest(String(params["tree"]));
          commits.set(sha, { tree: { sha: String(params["tree"]) } });
          result = { sha };
          break;
        }
        case "PATCH /repos/{owner}/{repo}/git/refs/{ref}":
          heads.set(String(params["repo"]), String(params["sha"]));
          result = {};
          break;
        case "POST /orgs/{org}/hooks": {
          const hook = {
            id: id++,
            active: Boolean(params["active"]),
            events: params["events"] as string[],
            config: params["config"] as Hook["config"],
          };
          hooks.set(hook.id, hook);
          result = hook;
          break;
        }
        case "PATCH /orgs/{org}/hooks/{hook_id}": {
          const hook = hooks.get(Number(params["hook_id"]))!;
          Object.assign(hook, { ...params, id: hook.id });
          result = hook;
          break;
        }
        case "DELETE /orgs/{org}/hooks/{hook_id}":
          hooks.delete(Number(params["hook_id"]));
          result = {};
          break;
        case "DELETE /repos/{owner}/{repo}":
          repositories.delete(String(params["repo"]));
          if (params["repo"] === "fixture-app") issues.clear();
          result = {};
          break;
        default:
          throw Error(`Unrecorded route ${route}`);
      }
      return structuredClone(result) as T;
    },
    async graph<T>(op: string, query: string, vars: Record<string, unknown> = {}) {
      record(op, query.startsWith("mutation"));
      let result: unknown;
      switch (op) {
        case "list projects":
          result = {
            organization: {
              id: "O1",
              projectsV2: {
                nodes: [...projects.values()],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          };
          break;
        case "create project": {
          const p: Project = { id: `P${id++}`, title: String(vars["title"]), number: 1 };
          projects.set(p.id, p);
          result = { createProjectV2: { projectV2: p } };
          break;
        }
        case "read project Status":
          result = {
            node: {
              fields: {
                nodes: [
                  {
                    name: "Status",
                    options: ["Todo", "In Progress", "Done"].map((name) => ({ name })),
                  },
                ],
              },
            },
          };
          break;
        case "list project items":
          result = {
            node: {
              items: {
                nodes: [...items].map((id) => ({ content: { id } })),
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          };
          break;
        case "add project item":
          items.add(String(vars["contentId"]));
          result = { addProjectV2ItemById: { item: { id: `ITEM${id++}` } } };
          break;
        case "delete project":
          projects.delete(String(vars["id"]));
          result = {};
          break;
        default:
          throw Error(`Unrecorded graph operation ${op}`);
      }
      return structuredClone(result) as T;
    },
    async listHooks() {
      record("list hooks", false);
      return structuredClone([...hooks.values()]);
    },
    async hook(hookId) {
      record("hook read", false);
      return structuredClone(hooks.get(hookId)!);
    },
    async updateHook(hookId, patch) {
      return api.rest("hook update", "PATCH /orgs/{org}/hooks/{hook_id}", {
        hook_id: hookId,
        ...patch,
      });
    },
  };
  return {
    ...api,
    repositories,
    issues,
    projects,
    hooks,
    calls,
    writes: () => calls.filter((c) => c.write),
    unmarked: () => [
      ...[...repositories.values()].filter((r) => !r.description?.includes("test-owned")),
      ...[...issues.values()].filter((i) => !i.body?.includes("test-owned")),
      ...[...projects.values()].filter((p) => !p.title.includes("test-owned")),
      ...[...hooks.values()].filter((h) => !h.config.url.includes("test-owned")),
    ],
    foreignRepository(name: string) {
      repositories.set(name, {
        id: 99,
        node_id: "FOREIGN",
        name,
        description: "Other",
        private: true,
        default_branch: "main",
      });
    },
  };
}
