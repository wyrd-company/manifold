// ---
// relationships:
//   implements: service-assembly
// ---
import { repositoryFields } from "../github-repository-fields/wiring.ts";
import { scopeOwnership } from "@wyrd-company/manifold-shared";
import { createMirror } from "./mirror.ts";
import { githubSteps } from "./migrations.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
import { startGitHubSource } from "./index.ts";
import { githubWebhookPath } from "../service/types.ts";
import type { HttpHost } from "../http-host/index.ts";
import type { GitHubSource } from "./index.ts";
import { taskMetadata as taskMetadataPart } from "../task-metadata/wiring.ts";
import { intake as intakePart } from "../intake/wiring.ts";
export const githubMirror = wiringPart({
  name: "github-mirror",
  start: (
    members: Required<Pick<Service, "store">>,
  ): { githubMirror: ReturnType<typeof createMirror> } => {
    const { store } = members;
    store.connection.migrate("github", githubSteps);
    const githubMirror = createMirror(store, Date.now);
    return { githubMirror };
  },
});

export const githubSource = wiringPart({
  name: "github-source",
  start: (
    members: Required<
      Pick<
        Service,
        "configuration" | "store" | "router" | "portfolio" | "revisions" | "gates" | "log"
      >
    > & { http: HttpHost; githubMirror: ReturnType<typeof createMirror> },
    context,
  ): { github: GitHubSource } => {
    const { configuration, store, router, portfolio, revisions, gates, http, log, githubMirror } =
      members;
    const taskMetadata = context.later(taskMetadataPart);
    const { options } = context;
    const intake = context.later(intakePart);
    const repositoryStorage = context.later(repositoryFields);
    const github = startGitHubSource({
      configuration: configuration.github,
      storageAdapters: repositoryStorage.get().githubRepositoryFields,
      credentials: configuration.credentials,
      store,
      router,
      boundProjects: () =>
        portfolio
          .current()
          .declaration.githubProjects.map(({ owner, number }) => ({ owner, number })),
      processRepository: {
        url: configuration.processRepository.url,
        branch: configuration.processRepository.branch,
        pull: revisions.pull,
      },
      lifecycleField: (projectId) => {
        const project = githubMirror.read().projects.get(projectId)?.project;
        const binding = project ? portfolio.githubProject(project)?.binding : undefined;
        return binding
          ? taskMetadata.get().taskMetadata.current()?.projects[binding]?.lifecycle.field
          : undefined;
      },
      taskFieldBinding: (project) => portfolio.githubProject(project)?.binding,
      taskFieldValues: (projectId, issue) => {
        const project = issue.projects.find((project) => project.nodeId === projectId);
        const binding = project ? portfolio.githubProject(project)?.binding : undefined;
        if (!binding) return;
        const metadata = taskMetadata.current()?.taskMetadata.current()?.projects[binding];
        const values = taskMetadata.current()?.taskMetadata.values(binding, issue);
        if (!values || !metadata) return;
        return Object.fromEntries(
          Object.entries(values).map(([name, value]) => [
            name,
            {
              storage: metadata.fields[name]!.storage.kind,
              storageName:
                metadata.fields[name]!.storage.kind === "project-field"
                  ? metadata.fields[name]!.storage.name
                  : undefined,
              value,
            },
          ]),
        );
      },
      scopes: () => {
        const declaration = taskMetadata.current()?.taskMetadata.current();
        if (!declaration) return [];
        const bindings = portfolio.current().declaration.githubProjects;
        const index = githubMirror.trackedIssueIndex(
          new Map([...githubMirror.read().projects].map(([id, row]) => [id, row.project])),
        );
        return [
          ...scopeOwnership(
            declaration,
            Object.fromEntries(bindings.map((binding) => [binding.name, binding.owner])),
            (name) => {
              const binding = bindings.find((binding) => binding.name === name);
              if (!binding) return [];
              return [
                ...new Set(
                  [...index.values()]
                    .filter((issue) =>
                      issue.projects.some(
                        (project) =>
                          project.owner.toLowerCase() === binding.owner.toLowerCase() &&
                          project.number === binding.number,
                      ),
                    )
                    .map((issue) => issue.issue.repository),
                ),
              ];
            },
          ).values(),
        ].map((owned) => owned.scope);
      },
      ...(options.probes?.projectFieldWrite
        ? { probeFieldWrite: options.probes.projectFieldWrite }
        : {}),
      ...(options.probes?.cardMove ? { probeMove: options.probes.cardMove } : {}),
      onTracked: (ids) => intake.current()?.intake.discovered(ids),
      onMirrorChanged: () => {
        gates?.inputChanged();
        intake.current()?.intake.mirrorChanged();
      },
      onError: (error) =>
        log({
          level: "error",
          event: "github-error",
          message: error.message,
          detail: { kind: error.kind },
        }),
    });
    context.onStop("sources", () => github.stop());
    http.mount(githubWebhookPath, github.requestListener);
    return { github };
  },
});
