// ---
// relationships:
//   verifies: [declarations-api, portfolio-api, operator-console]
// ---
import * as fs from "node:fs/promises";
import git from "isomorphic-git";
import { serviceFixture } from "../../service/test-fixtures/repository.ts";
import { startService } from "../../service/index.ts";
import { openProcessRepository } from "../../process-repository/index.ts";
import { stringify } from "yaml";
export const portfolioText = `# portfolio comment
items:
  alpha:
    allocations:
      acct-a: { guarantee: 40 }
    items:
      beta:
        allocations:
          acct-a: { guarantee: 40 }
      gamma:
        allocations:
          acct-a: { guarantee: 40 }
  delta:
    allocations:
      acct-a: { guarantee: 30 }
`;
export const bindingsText = `# bindings comment
githubProjects:
  board-one: { owner: sample, number: 1, environment: local, item: beta, t3codeProjects: [workspace-one] }
  board-two: { owner: sample, number: 2, environment: local, item: beta }
`;
export async function archiveFixture(withUsage = false) {
  const fixture = await serviceFixture();
  await fixture.commit(50, {
    accounts: {
      accounts: {
        "acct-a": {
          unit: "usd",
          kind: "api",
          ...(withUsage ? { usage: [{ environment: "local", provider: "codex" }] } : {}),
          capacity: { amount: 10, reset: "2026-01-01T00:00:00Z", every: { days: 1 } },
        },
      },
    },
  });
  await git.setConfig({ fs, gitdir: fixture.remote.gitdir, path: "http.receivepack", value: true });
  if (withUsage) await fs.writeFile(fixture.directory + "/environment.token", "synthetic-token");
  await fs.writeFile(
    fixture.file,
    stringify({
      ...fixture.configuration,
      ...(withUsage
        ? {
            credentials: {
              ...fixture.configuration.credentials,
              environment: { kind: "t3code-token", tokenFile: "environment.token" },
            },
            environments: { local: { url: "http://127.0.0.1:1", credential: "environment" } },
          }
        : {}),
      processRepository: {
        ...fixture.configuration.processRepository,
        commitAuthor: { name: "Example", email: "example@example.test" },
      },
    }),
  );
  const logs: unknown[] = [];
  const service = await startService({
    configurationFile: fixture.file,
    log: (entry) => {
      if (entry.level === "error") logs.push(entry);
    },
  });
  const seeded = await service.revisions.save({
    base: service.processRepository.current()!.commit,
    files: [
      { path: "portfolio.yml", text: portfolioText },
      { path: "bindings.yml", text: bindingsText },
    ],
    message: "Declare sample projects",
    saveId: "1".repeat(32),
  });
  if (seeded.outcome !== "saved") throw Error("Expected seeded revision");
  const address = service.http.address(),
    url = `http://${address.host}:${address.port}`;
  return {
    fixture,
    logs,
    service,
    url,
    base: seeded.commit,
    async concurrentBinding() {
      const repository = await openProcessRepository({
        configuration: {
          url: fixture.remote.url,
          branch: "main",
          directory: fixture.directory + "/concurrent",
          pullTimeoutMs: 60000,
          credential: undefined,
          commitAuthor: { name: "Example", email: "example@example.test" },
        },
        credentials: {
          names: [],
          resolve() {
            throw Error("Unused");
          },
        },
      });
      await repository.pull();
      const result = await repository.save({
        base: seeded.commit,
        files: [
          {
            path: "bindings.yml",
            text:
              bindingsText +
              "t3codeProjects:\n  board-three: { environment: local, project: workspace-three, item: gamma }\n",
          },
        ],
        message: "Add sample workspace",
        saveId: "2".repeat(32),
      });
      if (result.kind !== "pushed") throw Error("Expected concurrent commit");
      return result.commit;
    },
    async close() {
      await service.stop();
      await fixture.close();
    },
  };
}
