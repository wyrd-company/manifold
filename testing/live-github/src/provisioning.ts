// ---
// relationships:
//   implements: live-github-environment
// ---
import { hookEvents, hookConfiguration } from "./hooks.ts";
import { randomBytes } from "node:crypto";
import { readFile, rename, rm, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse, stringify } from "yaml";
import { ensureState, writeIfChanged } from "./settings.ts";
import type { Settings } from "./settings.ts";
import type { GitHubPort, Repository, Issue, Hook, Project } from "./github.ts";
export type Resource = { id: number; nodeId: string; name: string; number?: number };
export type Resources = {
  repository: Resource;
  processRepository: Resource & { head: string };
  issues: (Resource & { number: number })[];
  project: { id: string; nodeId: string; name: string; number: number };
  hook: { id: number; name: string };
};
type Options = {
  settings: Settings;
  directory: string;
  github: GitHubPort;
  afterWrite?: (name: string) => Promise<void>;
  report?: (resource: string, state: string) => void;
};
async function read(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
export async function readResources(directory: string): Promise<Resources> {
  const raw = await read(join(directory, "resources.json"));
  if (!raw) throw Error("Provisioning has not run: resources.json missing");
  return JSON.parse(raw) as Resources;
}
export async function contentFiles(directory: string) {
  const files: Record<string, string> = {};
  async function visit(prefix: string) {
    for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw Error(`Content contains a symbolic link: ${path}`);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files[path] = await readFile(join(directory, path), "utf8");
    }
  }
  await visit("");
  return files;
}
export function boundFiles(files: Record<string, string>, owner: string, number: number) {
  const result = { ...files };
  if (result["bindings.yml"]) {
    const doc = parse(result["bindings.yml"]) as {
      githubProjects?: Record<string, { owner: string; number: number }>;
    };
    for (const binding of Object.values(doc.githubProjects ?? {})) {
      binding.owner = owner;
      binding.number = number;
    }
    result["bindings.yml"] = stringify(doc);
  }
  return result;
}
const ownedRepo = (repo: Repository, marker: string) =>
  repo.description === `Test fixture (${marker})`;
const ownedHook = (hook: Hook, marker: string) => {
  try {
    return new URL(hook.config.url).searchParams.get("owner-marker") === marker;
  } catch {
    return false;
  }
};
async function allRest<T>(
  github: GitHubPort,
  op: string,
  route: string,
  parameters: Record<string, unknown> = {},
) {
  const all: T[] = [];
  for (let page = 1; ; page++) {
    const rows = await github.rest<T[]>(op, route, { ...parameters, per_page: 100, page });
    all.push(...rows);
    if (rows.length < 100) return all;
  }
}
async function projects(github: GitHubPort, owner: string) {
  const all: Project[] = [];
  let cursor: string | null = null;
  for (;;) {
    const data: {
      organization: {
        id: string;
        projectsV2: {
          nodes: Project[];
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      };
    } = await github.graph(
      "list projects",
      "query($owner:String!,$cursor:String){organization(login:$owner){id projectsV2(first:100,after:$cursor){nodes{id title number}pageInfo{hasNextPage endCursor}}}}",
      { owner, cursor },
    );
    all.push(...data.organization.projectsV2.nodes);
    if (!data.organization.projectsV2.pageInfo.hasNextPage)
      return { id: data.organization.id, projects: all };
    cursor = data.organization.projectsV2.pageInfo.endCursor;
  }
}
export async function provision(
  options: Options & { files: Record<string, string> },
): Promise<Resources> {
  const { settings: s, directory: d, github: g } = options;
  const after = options.afterWrite ?? (async () => {});
  const report = options.report ?? (() => {});
  await ensureState(d);
  async function file(name: string, value: string) {
    const path = join(d, name);
    if (await writeIfChanged(path, value)) await after(name);
  }
  async function write<T>(op: string, run: () => Promise<T>) {
    const result = await run();
    await after(`github:${op}`);
    return result;
  }
  let pending = await read(join(d, "hook.secret.pending"));
  let secret = await read(join(d, "hook.secret"));
  if (!pending && !secret) {
    pending = randomBytes(32).toString("hex");
    await file("hook.secret.pending", pending);
  }
  const repos = await allRest<Repository>(g, "list repositories", "GET /orgs/{org}/repos");
  async function repository(name: string) {
    const existing = repos.find((r) => r.name === name);
    if (existing) {
      if (!ownedRepo(existing, s.marker)) throw Error(`foreign repository: ${name}`);
      if (!existing.private) throw Error(`Owned repository must be private: ${name}`);
      report(name, "present");
      return existing;
    }
    const created = await write(`repository.${name}.create`, () =>
      g.rest<Repository>("create repository", "POST /orgs/{org}/repos", {
        name,
        description: `Test fixture (${s.marker})`,
        private: true,
        auto_init: true,
      }),
    );
    report(name, "created");
    return created;
  }
  const repo = await repository(s.repository);
  const found = await allRest<Issue>(g, "list seed issues", "GET /repos/{owner}/{repo}/issues", {
    repo: repo.name,
    state: "all",
  });
  const issues: Issue[] = [];
  for (let n = 1; n <= s.seedIssues; n++) {
    const title = `Sample item ${n}`;
    let issue = found.find((i) => !i.pull_request && i.title === title);
    if (issue) {
      if (!issue.body?.endsWith(`<!-- ${s.marker} -->`)) throw Error(`foreign issue: ${title}`);
      report(title, "present");
    } else {
      issue = await write(`issue.${n}.create`, () =>
        g.rest<Issue>("create seed issue", "POST /repos/{owner}/{repo}/issues", {
          repo: repo.name,
          title,
          body: `Sample issue\n\n<!-- ${s.marker} -->`,
        }),
      );
      report(title, "created");
    }
    issues.push(issue);
  }
  const listed = await projects(g, s.organization);
  const title = `${s.project} (${s.marker})`;
  let project = listed.projects.find((p) => p.title === title);
  if (!project && listed.projects.some((p) => p.title === s.project))
    throw Error(`foreign project: ${s.project}`);
  if (!project) {
    const result = await write("project.create", () =>
      g.graph<{ createProjectV2: { projectV2: Project } }>(
        "create project",
        "mutation($ownerId:ID!,$title:String!){createProjectV2(input:{ownerId:$ownerId,title:$title}){projectV2{id title number}}}",
        { ownerId: listed.id, title },
      ),
    );
    project = result.createProjectV2.projectV2;
    report(s.project, "created");
  } else report(s.project, "present");
  const fields = await g.graph<{
    node: { fields: { nodes: { name: string; options?: { name: string }[] }[] } };
  }>(
    "read project Status",
    "query($id:ID!){node(id:$id){... on ProjectV2{fields(first:100){nodes{... on ProjectV2SingleSelectField{name options{name}}}}}}}",
    { id: project.id },
  );
  const status = fields.node.fields.nodes.find((f) => f.name === "Status");
  if (
    !status ||
    !["Todo", "In Progress", "Done"].every((name) => status.options?.some((o) => o.name === name))
  )
    throw Error("Project missing built-in Status options: Todo, In Progress, Done");
  const items = new Set<string>();
  let cursor: string | null = null;
  for (;;) {
    const page: {
      node: {
        items: {
          nodes: { content: { id: string } | null }[];
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      };
    } = await g.graph(
      "list project items",
      "query($id:ID!,$cursor:String){node(id:$id){... on ProjectV2{items(first:100,after:$cursor){nodes{content{... on Issue{id}}}pageInfo{hasNextPage endCursor}}}}}",
      { id: project.id, cursor },
    );
    for (const item of page.node.items.nodes) if (item.content) items.add(item.content.id);
    if (!page.node.items.pageInfo.hasNextPage) break;
    cursor = page.node.items.pageInfo.endCursor;
  }
  for (const issue of issues) {
    if (items.has(issue.node_id)) {
      report(`Project item ${issue.number}`, "present");
      continue;
    }
    await write(`item.${issue.number}.create`, () =>
      g.graph(
        "add project item",
        "mutation($projectId:ID!,$contentId:ID!){addProjectV2ItemById(input:{projectId:$projectId,contentId:$contentId}){item{id}}}",
        { projectId: project.id, contentId: issue.node_id },
      ),
    );
    report(`Project item ${issue.number}`, "created");
  }
  const process = await repository(s.processRepository);
  const branch = await g.rest<{ object: { sha: string } }>(
    "read process branch",
    "GET /repos/{owner}/{repo}/git/ref/{ref}",
    { repo: process.name, ref: `heads/${process.default_branch}` },
  );
  const commit = await g.rest<{ tree: { sha: string } }>(
    "read process commit",
    "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
    { repo: process.name, commit_sha: branch.object.sha },
  );
  const content = boundFiles(options.files, s.organization, project.number);
  const current = await g.rest<{
    tree: { path: string; mode: string; type: string; sha: string }[];
  }>("read process tree", "GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
    repo: process.name,
    tree_sha: commit.tree.sha,
    recursive: "1",
  });
  // Git blob identities let an unchanged run avoid even a create-tree write.
  const { createHash } = await import("node:crypto");
  const blob = (value: string) =>
    createHash("sha1")
      .update(`blob ${Buffer.byteLength(value)}\0`)
      .update(value)
      .digest("hex");
  const entries = Object.entries(content).sort(([a], [b]) => a.localeCompare(b));
  const leaves = current.tree.filter((e) => e.type === "blob");
  let head = branch.object.sha;
  if (
    leaves.length !== entries.length ||
    entries.some(
      ([path, value]) =>
        !leaves.some((e) => e.path === path && e.sha === blob(value) && e.mode === "100644"),
    )
  ) {
    const tree = await write("tree.create", () =>
      g.rest<{ sha: string }>("create process tree", "POST /repos/{owner}/{repo}/git/trees", {
        repo: process.name,
        tree: entries.map(([path, value]) => ({
          path,
          mode: "100644",
          type: "blob",
          content: value,
        })),
      }),
    );
    if (tree.sha !== commit.tree.sha) {
      const next = await write("commit.create", () =>
        g.rest<{ sha: string }>(
          "commit process content",
          "POST /repos/{owner}/{repo}/git/commits",
          {
            repo: process.name,
            message: "Set test process content",
            tree: tree.sha,
            parents: [head],
          },
        ),
      );
      await write("branch.update", () =>
        g.rest("update process branch", "PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
          repo: process.name,
          ref: `heads/${process.default_branch}`,
          sha: next.sha,
        }),
      );
      head = next.sha;
      report("Process content", "updated");
    }
  } else report("Process content", "present");
  const hooks = (await g.listHooks()).filter((h) => ownedHook(h, s.marker));
  if (hooks.length > 1) throw Error("Multiple owned organization hooks");
  let hook = hooks[0];
  if (!hook) {
    hook = await write("hook.create", () =>
      g.rest<Hook>("create organization hook", "POST /orgs/{org}/hooks", {
        name: "web",
        active: false,
        events: hookEvents,
        config: hookConfiguration(
          `https://hook.invalid/webhooks/github?owner-marker=${encodeURIComponent(s.marker)}`,
          (pending ?? secret)!,
        ),
      }),
    );
    report("Hook", "created");
  } else {
    const configDiff = hook.config.content_type !== "json" || hook.config.insecure_ssl !== "0";
    const eventsDiff = [...hook.events].sort().join(",") !== [...hookEvents].sort().join(",");
    if (pending || configDiff || eventsDiff) {
      hook = await write("hook.update", () =>
        g.updateHook(hook!.id, {
          events: hookEvents,
          config: hookConfiguration(hook!.config.url, (pending ?? secret)!),
        }),
      );
      report("Hook", "updated");
    } else report("Hook", "present");
  }
  if (pending) {
    await rename(join(d, "hook.secret.pending"), join(d, "hook.secret"));
    await after("hook.secret.rename");
    secret = pending;
  }
  const resource = (r: Repository): Resource => ({ id: r.id, nodeId: r.node_id, name: r.name });
  const resources: Resources = {
    repository: resource(repo),
    processRepository: { ...resource(process), head },
    issues: issues.map((i) => ({ id: i.id, nodeId: i.node_id, name: i.title, number: i.number })),
    project: { id: project.id, nodeId: project.id, name: project.title, number: project.number },
    hook: { id: hook.id, name: "web" },
  };
  await file("resources.json", JSON.stringify(resources, null, 2) + "\n");
  return resources;
}
export async function teardown(options: Options) {
  const { settings: s, directory: d, github: g } = options;
  const after = options.afterWrite ?? (async () => {}),
    report = options.report ?? (() => {});
  for (const h of await g.listHooks()) {
    if (!ownedHook(h, s.marker)) continue;
    await g.rest("delete organization hook", "DELETE /orgs/{org}/hooks/{hook_id}", {
      hook_id: h.id,
    });
    await after("hook.remove");
    report("Hook", "removed");
  }
  report("Hook", "absent");
  let projectReported = false;
  for (const p of (await projects(g, s.organization)).projects) {
    if (p.title === `${s.project} (${s.marker})`) {
      await g.graph(
        "delete project",
        "mutation($id:ID!){deleteProjectV2(input:{projectId:$id}){deletedProjectV2Id}}",
        { id: p.id },
      );
      await after("project.remove");
      report(s.project, "removed");
      projectReported = true;
    } else if (p.title === s.project) {
      report(s.project, "foreign");
      projectReported = true;
    }
  }
  if (!projectReported) report(s.project, "absent");
  const repos = await allRest<Repository>(g, "list repositories", "GET /orgs/{org}/repos");
  for (const name of [s.repository, s.processRepository]) {
    const repo = repos.find((r) => r.name === name);
    if (!repo) {
      report(name, "absent");
      continue;
    }
    if (!ownedRepo(repo, s.marker)) {
      report(name, "foreign");
      continue;
    }
    await g.rest("delete repository", "DELETE /repos/{owner}/{repo}", { repo: name });
    await after(`${name}.remove`);
    report(name, "removed");
  }
  for (const name of [
    "hook.secret",
    "hook.secret.pending",
    "service.yml",
    "service",
    "tunnel",
    "children.json",
    "resources.json",
  ]) {
    const path = resolve(d, name);
    try {
      await stat(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    await rm(path, { force: true, recursive: true });
    await after(`${name}.remove`);
  }
}
