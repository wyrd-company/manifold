// ---
// relationships:
//   verifies: [operator-console, task-metadata]
// ---
import { projectsHost } from "../../declarations-api/test-fixtures/projects-host.ts";
import { repositoryFixture } from "./repository.ts";
import type { ScopeConfiguration, TrackedIssue } from "../../github-source/index.ts";
import { scopeKey } from "@wyrd-company/manifold-shared";
export const repositoryMetadata = `# retain
projects:
  delivery:
    lifecycle: {field: Stage, options: [Ready, Delivered]}
    repositories: [sample/*]
    fields:
      size:
        type: single-select
        storage: {kind: label, prefix: 'size: '}
        whenChanged: accept
        options: [{name: Small, color: aabbcc, description: Compact}, Large]
      batch:
        type: single-select
        storage: {kind: milestone}
        options: [Spring]
  secondary:
    lifecycle: {field: Stage, options: [Ready, Delivered]}
`;
export async function repositoryConsole() {
  const platform = await repositoryFixture();
  const scopes = new Map<string, ScopeConfiguration>();
  const issues: TrackedIssue[] = ["sample/depot", "elsewhere/outside"].map((repository, i) => ({
    ...platform.issue,
    issue: { ...platform.issue.issue, repository, nodeId: `I_${i}` },
    projects: [{ nodeId: "project-1", owner: "example", number: 1 }],
    items: [
      {
        nodeId: `IT_${i}`,
        project: { nodeId: "project-1", owner: "example", number: 1 },
        archived: false,
        fields: {},
      },
    ],
  }));
  let failAt: number | undefined;
  let writes = 0;
  const source = {
    trackedIssueIndex: () => new Map(issues.map((i) => [i.issue.nodeId, i])),
    scopeConfiguration: (scope: import("@wyrd-company/manifold-shared").StorageScope) =>
      scopes.get(scopeKey(scope)),
    observeScope: async (scope: import("@wyrd-company/manifold-shared").StorageScope) => {
      const observed = await platform.adapters.observeScope(scope);
      scopes.set(scopeKey(scope), observed);
      return observed;
    },
    writeScopeEntity: async (write: import("../../github-source/index.ts").ScopeEntityWrite) => {
      if (writes === failAt) throw new Error("interrupted");
      const entity = await platform.adapters.writeScopeEntity(write);
      writes++;
      return entity;
    },
  };
  const host = await projectsHost("127.0.0.1", source);
  await host.changeTaskMetadata(repositoryMetadata);
  await host.service.revisions.pull();
  // The fixture's configuration shares the actual repository and save boundary.
  await host.configuration.apply(host.service.processRepository.current()!);
  return {
    ...host,
    platform,
    issues,
    writes: () => writes,
    failAt: (n: number | undefined) => {
      failAt = n;
    },
    async close() {
      await host.close();
      await platform.close();
    },
  };
}
