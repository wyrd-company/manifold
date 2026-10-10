// ---
// relationships:
//   verifies: [task-metadata, github-event-source, operator-console]
// ---
import { writeFile } from "node:fs/promises";
import git from "isomorphic-git";
import * as fs from "node:fs/promises";
import { stringify } from "yaml";
import { expect } from "vite-plus/test";
import { serviceFixture } from "../../service/test-fixtures/repository.ts";
import type { TaskMetadata } from "../index.ts";
import { startService } from "../../service/index.ts";
import { organizationFake } from "../../github-source/test-fixtures/organization-api.ts";
export const organizationMetadata = (accept = false) => ({
  projects: Object.fromEntries(
    ["first", "second"].map((binding) => [
      binding,
      {
        lifecycle: { field: "Stage", options: ["Sorting", "Packed", "Shipped"] },
        fields: {
          priority: {
            type: "single-select",
            whenChanged: accept ? "accept" : "revert",
            storage: { kind: "issue-field", organization: "sample", name: "Urgency" },
            options: ["Normal", "High"],
          },
          category: {
            type: "single-select",
            whenChanged: accept ? "accept" : "revert",
            storage: { kind: "issue-type", organization: "sample" },
            options: ["Request", "Return"],
          },
        },
      },
    ]),
  ),
});
export const organizationBindings = {
  githubProjects: {
    first: { owner: "sample", number: 1, environment: "local", item: "alpha" },
    second: { owner: "sample", number: 2, environment: "local", item: "alpha" },
  },
};
export async function organizationHost(
  accept = false,
  userProject = false,
  declaredOrganization = true,
) {
  const repository = await serviceFixture();
  const api = await organizationFake(repository.api);
  repository.api.addItem("IT_A", "I_A");
  const bindings = userProject
    ? {
        githubProjects: Object.fromEntries(
          Object.entries(organizationBindings.githubProjects).map(([name, binding]) => [
            name,
            { ...binding, owner: "visitor" },
          ]),
        ),
      }
    : organizationBindings;
  const metadata = organizationMetadata(accept);
  if (!declaredOrganization)
    for (const project of Object.values(metadata.projects))
      for (const field of Object.values(project.fields))
        Reflect.deleteProperty(field.storage, "organization");
  await repository.commit(60, { bindings, taskMetadata: metadata });
  await git.setConfig({
    fs,
    gitdir: repository.remote.gitdir,
    path: "http.receivepack",
    value: true,
  });
  await writeFile(
    repository.file,
    stringify({
      ...repository.configuration,
      github: {
        ...repository.configuration.github,
        apiUrl: api.url,
        owners: {
          ...repository.configuration.github.owners,
          ...(userProject ? { visitor: { credential: "api-reader", hooks: [] } } : {}),
        },
      },
      processRepository: {
        ...repository.configuration.processRepository,
        commitAuthor: { name: "Example", email: "example@example.test" },
      },
    }),
  );
  const start = async () =>
    (await startService({ configurationFile: repository.file, log: () => {} })) as Awaited<
      ReturnType<typeof startService>
    > & { taskMetadata: TaskMetadata };
  let service = await start();
  async function ready() {
    await expect.poll(() => service.github.trackedIssue("I_A")?.content).toBeDefined();
    await expect
      .poll(() => service.github.projectByNumber(userProject ? "visitor" : "sample", 2))
      .toBeDefined();
  }
  await ready();
  return {
    repository,
    api,
    get service() {
      return service;
    },
    get url() {
      return `http://${service.http.address().host}:${service.http.address().port}`;
    },
    async restart() {
      await service.stop();
      service = await start();
      await ready();
    },
    async close() {
      await service.stop();
      await api.close();
      await repository.close();
    },
  };
}
