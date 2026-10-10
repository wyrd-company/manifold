// ---
// relationships:
//   verifies: [operator-console, declarations-api]
// ---
import * as fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import git from "isomorphic-git";
import { stringify } from "yaml";
import { serviceFixture } from "../../service/test-fixtures/repository.ts";
import { startService } from "../../service/index.ts";
import { createHttpHost } from "../../http-host/index.ts";
import { mountConsole } from "../../console/index.ts";
import { boardWorld } from "../../tasks/test-fixtures/world.ts";
import { mountDeclarationsApi } from "../index.ts";
import { openTaskMetadata } from "../../task-metadata/index.ts";
import type { ProjectField, ProjectFieldWrite } from "../../github-source/index.ts";

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
  let holdNextSave = false;
  const service = await startService({
    configurationFile: repository.file,
    log: () => {},
    probes: {
      save(step) {
        if (step === "pushed" && holdNextSave) {
          holdNextSave = false;
          repository.remote.state.refuseNextFetch = true;
        }
      },
    },
  });
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
  let sequence = 0;
  const fields = new Map<string, ProjectField[]>();
  const stage = (): ProjectField => ({
    nodeId: `field-${++sequence}`,
    name: "Stage",
    type: "single-select",
    options: ["Ready", "Delivered"].map((name) => ({
      id: `option-${++sequence}`,
      name,
      color: "gray",
      description: "",
    })),
  });
  for (const number of [1, 2]) fields.set(`project-${number}`, [stage()]);
  const source = {
    project: () => undefined,
    projectByNumber: (owner: string, number: number) => ({
      nodeId: `project-${number}`,
      owner,
      number,
    }),
    moveCard: async () => {},
    projectFields: (projectNodeId: string) => ({
      projectNodeId,
      readAt: 1700000000000,
      fields: fields.get(projectNodeId) ?? [],
    }),
    observeProjectFields: async (projectNodeId: string) => source.projectFields(projectNodeId),
    writeProjectField: async (write: ProjectFieldWrite) => {
      const previous = fields.get(write.projectNodeId) ?? [];
      if (write.kind === "delete") {
        fields.set(
          write.projectNodeId,
          previous.filter((field) => field.nodeId !== write.fieldNodeId),
        );
        return;
      }
      const field: ProjectField =
        write.kind === "create"
          ? {
              nodeId: `field-${++sequence}`,
              name: write.name,
              type: write.type,
              options: (write.options ?? []).map((option) => ({
                ...option,
                id: `option-${++sequence}`,
              })),
            }
          : {
              ...previous.find((field) => field.nodeId === write.fieldNodeId)!,
              ...(write.name !== undefined ? { name: write.name } : {}),
              ...(write.options !== undefined
                ? {
                    options: write.options.map((option) => ({
                      ...option,
                      id: option.id ?? `option-${++sequence}`,
                    })),
                  }
                : {}),
            };
      fields.set(
        write.projectNodeId,
        write.kind === "create"
          ? [...previous, field]
          : previous.map((old) => (old.nodeId === write.fieldNodeId ? field : old)),
      );
      return field;
    },
  };
  const configuration = openTaskMetadata({
    connection: service.store.connection,
    source: async () => source,
    actorOf: () => undefined,
    invocationOf: () => ({ actorId: "example", invokeId: "example", entryId: "example" }),
    bindingOf: () => undefined,
    bindings: () =>
      service.portfolio
        .current()
        .declaration.githubProjects.filter((binding) => !binding.archived)
        .map((binding) => ({
          binding: binding.name,
          owner: binding.owner,
          number: binding.number,
          environment: binding.environment,
          portfolioItem: binding.item,
        })),
    revisions: service.revisions,
    revisionAt: service.processRepository.revisionAt,
    now: () => 1700000000000,
  });
  await configuration.apply(service.processRepository.current()!);
  for (const binding of ["delivery", "secondary"]) {
    const initial = await configuration.projects.plan(binding);
    await configuration.projects.apply(binding, { digest: initial.digest, removeUndeclared: true });
  }
  function addRemoval(binding: string, name: string) {
    const number = service.portfolio
      .current()
      .declaration.githubProjects.find((b) => b.name === binding)!.number;
    fields
      .get(`project-${number}`)!
      .push({ nodeId: `field-${++sequence}`, name, type: "text", options: [] });
  }
  for (const binding of ["delivery", "secondary"]) {
    const number = binding === "delivery" ? 1 : 2;
    const before = fields.get(`project-${number}`)!;
    fields.set(
      `project-${number}`,
      before.map((field) => ({ ...field, options: [...field.options].reverse() })),
    );
    addRemoval(binding, "Obsolete");
  }
  const plan = (binding: string) => configuration.projects.plan(binding);
  mountConsole(server.host, { store: service.store, history: service.history });
  server.host.mount("/api/tasks", board.tasks.requestListener);
  server.host.mount("/api/projects", async (request, response) => {
    await configuration.apply(service.processRepository.current()!);
    await configuration.requestListener(request, response);
  });
  let saveAttempts = 0;
  mountDeclarationsApi(server.host, {
    createdProjects: () => [],
    revisions: {
      findSave: async () => undefined,
      latest: service.revisions.latest,
      save: (request) => {
        saveAttempts++;
        return service.revisions.save(request);
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
    planDeclaration: configuration.projects.planDeclaration,
    log: () => {},
  });
  return {
    ...server,
    repository,
    service,
    addRemoval(binding = "delivery") {
      addRemoval(binding, "Legacy");
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
      await configuration.close();
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
