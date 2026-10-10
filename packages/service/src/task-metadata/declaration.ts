// ---
// relationships:
//   implements: task-metadata
// ---
import type { ProcessRepositoryRevision } from "@wyrd-company/manifold-shared";
import { taskFieldValues } from "./values.ts";
import { repositoryInScope } from "@wyrd-company/manifold-shared";
import { createProjects } from "./projects.ts";
import { projectsEndpoint } from "./endpoint.ts";
import { lintTaskMetadataDeclaration } from "@wyrd-company/manifold-shared";
import type { TaskMetadata, TaskMetadataOptions } from "./types.ts";
import { metadataRecords } from "./records.ts";
import { metadataImplementations } from "./implementations.ts";
export function openTaskMetadata(options: TaskMetadataOptions): TaskMetadata {
  const records = metadataRecords(options.connection);
  let declaration = records.current();
  let acceptedRevision: ProcessRepositoryRevision | undefined;
  const current = () => declaration;
  const configuration = createProjects(options, records, current, () => acceptedRevision);
  return {
    current,
    values(binding, issue) {
      const metadata = current()?.projects[binding];
      if (!metadata) return undefined;
      const bound = options.bindings?.().find((value) => value.binding === binding);
      const project = issue.projects.find(
        (project) =>
          bound &&
          project.owner.toLowerCase() === bound.owner.toLowerCase() &&
          project.number === bound.number,
      );
      if (!project) return undefined;
      return taskFieldValues({
        metadata,
        project,
        issue,
        inScope: (repository) => repositoryInScope(metadata.repositories ?? [], repository),
      });
    },
    projects: configuration.projects,
    requestListener: projectsEndpoint(configuration.projects),
    close: configuration.close,
    implementations: metadataImplementations(options, current),
    async apply(revision) {
      const [taskMetadata, bindings] = await Promise.all([
        revision.read("task-metadata.yml"),
        revision.read("bindings.yml"),
      ]);
      const result = lintTaskMetadataDeclaration({ taskMetadata, bindings });
      if (!result.ok) {
        records.reject(revision.commit, result.findings);
        return { status: "rejected", commit: revision.commit, findings: result.findings };
      }
      records.accept(revision.commit, result.declaration);
      declaration = result.declaration;
      acceptedRevision = revision;
      return { status: "applied", commit: revision.commit };
    },
  };
}
