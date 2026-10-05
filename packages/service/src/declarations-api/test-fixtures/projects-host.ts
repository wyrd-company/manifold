// ---
// relationships:
//   verifies: [operator-console, declarations-api]
// ---
import * as fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import http from "isomorphic-git/http/web";
import type { SaveRequest } from "../../process-repository/index.ts";
import type { SavedRevision } from "../../service/index.ts";
import git from "isomorphic-git";
import { stringify, parse } from "yaml";
import { serviceFixture } from "../../service/test-fixtures/repository.ts";
import { startService } from "../../service/index.ts";
import { createHttpHost } from "../../http-host/index.ts";
import { mountConsole } from "../../console/index.ts";
import { boardWorld } from "../../tasks/test-fixtures/world.ts";
import { mountDeclarationsApi } from "../index.ts";

export async function projectsHost(host = "127.0.0.1") {
  const repository = await serviceFixture();
  const bindings = {
    githubProjects: {
      delivery: { owner: "example", number: 1, environment: "local", item: "alpha" },
      secondary: { owner: "example", number: 2, environment: "local", item: "alpha" },
    },
  };
  const metadata = {
    projects: {
      delivery: { lifecycle: { field: "Stage", options: ["Ready", "Delivered"] } },
      secondary: { lifecycle: { field: "Stage", options: ["Ready", "Delivered"] } },
    },
  };
  await repository.commit(60, { bindings, taskMetadata: metadata });
  await git.setConfig({
    fs,
    gitdir: repository.remote.gitdir,
    path: "http.receivepack",
    value: true,
  });
  await fs.writeFile(
    repository.file,
    stringify({
      ...repository.configuration,
      processRepository: {
        ...repository.configuration.processRepository,
        commitAuthor: { name: "Example", email: "example@example.test" },
      },
    }),
  );
  const service = await startService({ configurationFile: repository.file, log: () => {} });
  const httpHost = createHttpHost({
    configuration: { host, port: 0 },
    onError: (error) => {
      throw error;
    },
  });
  const address = await httpHost.listen();
  const server = {
    host: httpHost,
    url: `http://${address.host}:${address.port}`,
    close: () => httpHost.close(),
  };
  const board = boardWorld();
  const states = new Map<string, { applied: boolean; extra: boolean; newlyBound?: boolean }>([
    ["delivery", { applied: false, extra: false }],
    ["secondary", { applied: false, extra: false }],
  ]);
  const change = (field: string, removal: boolean) => ({
    id: field,
    storage: "project-field" as const,
    target: { field, lifecycle: !removal },
    description: removal
      ? `Remove the ${field} field.`
      : "Restore Stage options to the declared order.",
    action: removal ? ("remove" as const) : ("change" as const),
    side: "github" as const,
    drift: !removal,
    requiresRemoval: removal,
    properties: removal ? [] : ["order"],
    from: { name: field, type: "single-select", options: [] },
    to: removal
      ? null
      : {
          name: "Stage",
          type: "single-select",
          options: [
            { name: "Ready", color: "gray", description: "" },
            { name: "Delivered", color: "gray", description: "" },
          ],
        },
  });
  function plan(binding: string) {
    const state = states.get(binding)!;
    const changes = state.applied
      ? []
      : [
          change("Stage", false),
          change("Obsolete", true),
          ...(state.extra ? [change("Legacy", true)] : []),
        ];
    return {
      binding,
      owner: "example",
      number: binding === "delivery" ? 1 : binding === "secondary" ? 2 : 3,
      projectNodeId: `project-${binding === "delivery" ? 1 : binding === "secondary" ? 2 : 3}`,
      declarationCommit: service.revisions.latest()!.commit,
      observedAt: 1700000000000,
      observation: { status: "fresh" },
      configuration: state.applied
        ? { state: "in-sync" }
        : state.newlyBound
          ? { state: "not-applied" }
          : { state: "drift", count: changes.length },
      digest: createHash("sha256").update(JSON.stringify(changes)).digest("hex"),
      changes,
      fields: [
        {
          field: "Stage",
          lifecycle: true,
          github: state.applied ? "present" : "differs",
          detail: state.applied ? "Stage matches the declaration." : "Stage options differ.",
        },
      ],
      frontMatter: null,
    };
  }
  mountConsole(server.host, { store: service.store });
  server.host.mount("/api/tasks", board.tasks.requestListener);
  // The Project configuration module merges before this task. This structural
  // listener holds its approved HTTP contract without taking ownership of it.
  server.host.mount("/api/projects", async (request, response) => {
    const current = service.processRepository.current()!;
    const declared = parse((await current.read("bindings.yml")) ?? "{}") as {
      githubProjects?: Record<string, unknown>;
    };
    for (const name of Object.keys(declared.githubProjects ?? {}))
      if (!states.has(name)) states.set(name, { applied: false, extra: false, newlyBound: true });
    const parts = new URL(request.url!, server.url).pathname.split("/");
    const binding = decodeURIComponent(parts[3] ?? "");
    const answer = (status: number, body: unknown) =>
      response
        .writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" })
        .end(JSON.stringify(body));
    if (!binding) {
      answer(200, {
        projects: [...states.keys()].map((name) => ({
          binding: name,
          owner: "example",
          number: plan(name).number,
          projectNodeId: plan(name).projectNodeId,
          configuration: plan(name).configuration,
          observedAt: plan(name).observedAt,
          portfolioItem: "alpha",
          environment: "local",
          lastApplied: states.get(name)!.applied
            ? { at: 1700000000000, commit: service.revisions.latest()!.commit }
            : null,
        })),
      });
      return;
    }
    if (!states.has(binding)) {
      answer(404, { error: { kind: "unknown-binding", message: "Unknown Project binding." } });
      return;
    }
    if (parts[4] === "plan") {
      answer(200, plan(binding));
      return;
    }
    if (parts[4] !== "apply") {
      answer(404, {});
      return;
    }
    let body = "";
    for await (const chunk of request) body += chunk;
    const reviewed = JSON.parse(body) as { digest: string; removeUndeclared: boolean };
    const before = plan(binding);
    const state = states.get(binding)!;
    if (reviewed.digest !== before.digest) {
      answer(409, {
        error: { kind: "plan-stale", message: "The plan changed. Review the changes again." },
      });
      return;
    }
    state.applied = true;
    answer(200, {
      outcome: before.changes.length ? "applied" : "in-sync",
      writes: before.changes.length,
      changes: before.changes.map((entry) => ({
        ...entry,
        outcome: entry.requiresRemoval && !reviewed.removeUndeclared ? "kept" : "applied",
      })),
      configuration: { state: "in-sync" },
      declarationCommit: service.revisions.latest()!.commit,
    });
  });
  let heldRevision: ReturnType<typeof service.revisions.latest>;
  let holdNextSave = false;
  let saveAttempts = 0;
  mountDeclarationsApi(server.host, {
    revisions: {
      latest: () => heldRevision ?? service.revisions.latest(),
      // Test-only structural stand-in for the caller-owned path policy from
      // Project configuration. It writes real objects and pushes over smart HTTP.
      async save(request: SaveRequest): Promise<SavedRevision> {
        saveAttempts++;
        const hold = holdNextSave;
        holdNextSave = false;
        heldRevision = undefined;
        await service.revisions.pull();
        if (hold) heldRevision = service.revisions.latest();
        const current = service.processRepository.current()!;
        const base = await service.processRepository.revisionAt(request.base);
        const saved = await service.processRepository.findSave(request);
        if (saved)
          return {
            outcome: "already-saved",
            commit: saved,
            blueprints: service.revisions.latest(),
          };
        const text = await current.read(request.path);
        if (!base || (await base.read(request.path)) !== text)
          return { outcome: "conflict", reason: "file-changed", head: current.commit, text };
        if (text === request.text)
          return {
            outcome: "unchanged",
            commit: current.commit,
            blueprints: service.revisions.latest(),
          };
        const objects = { fs, gitdir: join(repository.directory, "clone", "git") };
        const previous = await git.readCommit({ ...objects, oid: current.commit });
        const root = await git.readTree({ ...objects, oid: previous.commit.tree });
        const blob = await git.writeBlob({ ...objects, blob: Buffer.from(request.text) });
        const tree = await git.writeTree({
          ...objects,
          tree: [
            ...root.tree.filter((entry) => entry.path !== request.path),
            { path: request.path, mode: "100644", type: "blob", oid: blob },
          ],
        });
        const author = {
          name: "Example",
          email: "example@example.test",
          timestamp: 1700000001,
          timezoneOffset: 0,
        };
        const commit = await git.writeCommit({
          ...objects,
          commit: {
            tree,
            parent: [current.commit],
            message: `${request.message}\n\nManifold-Save: ${request.saveId}\n`,
            author,
            committer: author,
          },
        });
        await git.writeRef({
          ...objects,
          ref: "refs/manifold/browser-save",
          value: commit,
          force: true,
        });
        const pushed = await git.push({
          ...objects,
          http,
          url: repository.remote.url,
          ref: "refs/manifold/browser-save",
          remoteRef: "refs/heads/main",
        });
        if (!pushed.ok) throw new Error("Fixture smart HTTP push failed");
        if (!hold) await service.revisions.pull();
        return {
          outcome: "saved",
          commit,
          blueprints: hold ? undefined : service.revisions.latest(),
        };
      },
    },
    processRepository: service.processRepository,
    repository: { url: repository.remote.url, branch: "main" },
    environments: ["local"],
    t3codeProjects: () => [
      {
        id: "workspace-1",
        title: "Parcel workspace",
        workspaceRoot: "/tmp/example-workspace",
        activeThreads: 2,
      },
    ],
    planDeclaration: () => [
      {
        binding: "delivery",
        changes: [{ action: "create" }],
        fields: [{ lifecycle: true, github: "present", detail: "Stage matches." }],
      },
    ],
    log: () => {},
  });
  return {
    ...server,
    repository,
    service,
    addRemoval(binding = "delivery") {
      states.get(binding)!.extra = true;
    },
    plan,
    deferNextSave() {
      holdNextSave = true;
    },
    saveAttempts: () => saveAttempts,
    remoteHead: () => git.resolveRef({ fs, gitdir: repository.remote.gitdir, ref: "main" }),
    async changeTaskMetadata(text: string) {
      const head = await git.resolveRef({ fs, gitdir: repository.remote.gitdir, ref: "main" });
      const previous = await git.readCommit({ fs, gitdir: repository.remote.gitdir, oid: head });
      const root = await git.readTree({
        fs,
        gitdir: repository.remote.gitdir,
        oid: previous.commit.tree,
      });
      const blob = await git.writeBlob({
        fs,
        gitdir: repository.remote.gitdir,
        blob: Buffer.from(text),
      });
      const tree = await git.writeTree({
        fs,
        gitdir: repository.remote.gitdir,
        tree: root.tree.map((entry) =>
          entry.path === "task-metadata.yml" ? { ...entry, oid: blob } : entry,
        ),
      });
      const commit = await git.writeCommit({
        fs,
        gitdir: repository.remote.gitdir,
        commit: { ...previous.commit, parent: [head], tree, message: "Remote task fields change" },
      });
      await repository.remote.force(commit);
      return commit;
    },
    async changeBindings() {
      const head = await git.resolveRef({ fs, gitdir: repository.remote.gitdir, ref: "main" });
      const previous = await git.readCommit({ fs, gitdir: repository.remote.gitdir, oid: head });
      const root = await git.readTree({
        fs,
        gitdir: repository.remote.gitdir,
        oid: previous.commit.tree,
      });
      const text = await service.processRepository.current()!.read("bindings.yml");
      const blob = await git.writeBlob({
        fs,
        gitdir: repository.remote.gitdir,
        blob: Buffer.from("# Keep this remote comment\n" + text + "\n# Earlier remote change\n"),
      });
      const tree = await git.writeTree({
        fs,
        gitdir: repository.remote.gitdir,
        tree: root.tree.map((entry) =>
          entry.path === "bindings.yml" ? { ...entry, oid: blob } : entry,
        ),
      });
      const commit = await git.writeCommit({
        fs,
        gitdir: repository.remote.gitdir,
        commit: { ...previous.commit, parent: [head], tree, message: "Add remote comments" },
      });
      await repository.remote.force(commit);
      return commit;
    },
    async close() {
      await server.close();
      await board.close();
      await service.stop();
      await repository.close();
    },
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fixture = await projectsHost("0.0.0.0");
  console.log(fixture.url);
  const stop = async () => {
    await fixture.close();
    process.exit(0);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
