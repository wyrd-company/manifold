// ---
// relationships:
//   verifies: [projects-api, task-metadata, github-event-source]
// ---
// Live verification tooling. Credentials are read only by the existing live
// tooling and credential resolver; no credential or raw API error is logged.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { stringify } from "yaml";
import { graphql, GraphqlResponseError } from "@octokit/graphql";
import { memoryRevision } from "@wyrd-company/manifold-shared";
import { loadSettings, readCredential, readApp } from "./settings.ts";
import { GitHub } from "./github.ts";
import { loadServiceConfiguration } from "../../../packages/service/dist/service-configuration/index.js";
import { openStore } from "../../../packages/service/dist/store/index.js";
import { startRouter } from "../../../packages/service/dist/router/index.js";
import { startGitHubSource } from "../../../packages/service/dist/github-source/index.js";
import {
  openTaskMetadata,
  taskMetadataMigrationSteps,
} from "../../../packages/service/dist/task-metadata/index.js";
async function main() {
  const settings = await loadSettings();
  const pat = await readCredential(settings.credentials.patFile);
  const github = new GitHub(settings.organization, pat);
  const app = await readApp(settings);
  const owner = await github.graph(
    "read test owner",
    "query($login:String!){organization(login:$login){id}}",
    { login: settings.organization },
  );
  const created = await github.graph(
    "create fresh test Project",
    "mutation($owner:ID!,$title:String!){createProjectV2(input:{ownerId:$owner,title:$title}){projectV2{id number}}}",
    { owner: owner.organization.id, title: `Sample configuration ${randomUUID()}` },
  );
  const project = created.createProjectV2.projectV2;
  const directory = await mkdtemp(join(tmpdir(), "project-config-live-"));
  let stop;
  try {
    const configFile = join(directory, "service.yml");
    await writeFile(
      configFile,
      stringify({
        store: { file: join(directory, "store.sqlite") },
        credentials: {
          reader: {
            kind: "github-app",
            ...app,
            privateKeyFile: settings.credentials.appPrivateKeyFile,
          },
        },
        github: { owners: { [settings.organization]: { credential: "reader", hooks: [] } } },
        processRepository: {
          url: `https://github.com/${settings.organization}/${settings.processRepository}.git`,
          directory: join(directory, "process"),
        },
      }),
    );
    const configuration = await loadServiceConfiguration(configFile);
    const store = openStore({ path: join(directory, "store.sqlite") });
    store.connection.migrate("metadata", taskMetadataMigrationSteps);
    const router = startRouter({
      store,
      host: {
        subscription: () => ({ topics: [] }),
        restore: () => ({ status: "held", reason: "No live actors" }),
      },
    });
    const source = startGitHubSource({
      configuration: configuration.github,
      credentials: configuration.credentials,
      store,
      router,
      boundProjects: () => [{ owner: settings.organization, number: project.number }],
      processRepository: {
        url: configuration.processRepository.url,
        branch: "main",
        pull: async () => ({ kind: "unchanged", commit: "a".repeat(40) }),
      },
      onError: (error) => {
        console.error(
          JSON.stringify({ event: "source-error", kind: error.kind, message: error.message }),
        );
      },
    });
    const metadata = openTaskMetadata({
      connection: store.connection,
      actorOf: () => undefined,
      invocationOf: () => ({ actorId: "parcel", invokeId: "stage", entryId: "entry" }),
      source: async () => source,
      bindingOf: () => "parcels",
      bindings: () => [
        {
          binding: "parcels",
          owner: settings.organization,
          number: project.number,
          portfolioItem: "shipments",
          environment: "local",
        },
      ],
      revisions: {
        save: async () => {
          throw new Error("This check declares revert fields");
        },
      },
    });
    stop = async () => {
      await metadata.close();
      await source.stop();
      router.stop();
      store.close();
    };
    const result = await metadata.apply(
      memoryRevision("a".repeat(40), {
        "bindings.yml": stringify({
          githubProjects: {
            parcels: {
              owner: settings.organization,
              number: project.number,
              item: "shipments",
              environment: "local",
            },
          },
        }),
        "task-metadata.yml": stringify({
          projects: {
            parcels: {
              lifecycle: { field: "Phase", options: ["Packed", "Sent"] },
              fields: { mass: { type: "number" } },
            },
          },
        }),
      }),
    );
    if (result.status !== "applied") throw new Error("Live declaration rejected");
    for (
      let attempt = 0;
      attempt < 100 && !source.projectByNumber(settings.organization, project.number);
      attempt++
    )
      await delay(100);
    if (!source.projectByNumber(settings.organization, project.number))
      throw new Error("Fresh Project was not resolved");
    const first = await metadata.projects.apply("parcels", { removeUndeclared: false });
    if (first.configuration.state !== "in-sync" || first.writes !== 2)
      throw new Error("Fresh Apply did not converge");
    console.log(
      JSON.stringify({
        step: "fresh-project-apply",
        github: "real App",
        writes: first.writes,
        state: first.configuration.state,
      }),
    );
    const observed = source.projectFields(project.id);
    const phase = observed.fields.find((field) => field.name === "Phase");
    const options = phase.options.map((option, index) => ({
      id: option.id,
      name: index === 0 ? "Ready" : option.name,
      color: option.color.toUpperCase(),
      description: option.description,
    }));
    await github.graph(
      "change declared option by hand",
      "mutation($field:ID!,$options:[ProjectV2SingleSelectFieldOptionInput!]!){updateProjectV2Field(input:{fieldId:$field,singleSelectOptions:$options}){projectV2Field{... on ProjectV2SingleSelectField{id}}}}",
      { field: phase.nodeId, options },
    );
    const drift = await metadata.projects.plan("parcels");
    if (drift.configuration.state !== "drift" || drift.configuration.count !== 1)
      throw new Error("Manual option rename was not observed as drift");
    console.log(
      JSON.stringify({
        step: "manual-option-rename-and-observation",
        github: "real PAT write; real App read",
        state: drift.configuration.state,
        count: drift.configuration.count,
      }),
    );
    const restored = await metadata.projects.apply("parcels", {
      removeUndeclared: false,
      digest: drift.digest,
    });
    if (
      restored.configuration.state !== "in-sync" ||
      source.projectFields(project.id).fields.find((f) => f.name === "Phase").options[0].id !==
        phase.options[0].id
    )
      throw new Error("Apply did not restore the option with its id");
    console.log(
      JSON.stringify({
        step: "drift-revert",
        github: "real App",
        writes: restored.writes,
        state: restored.configuration.state,
        optionIdPreserved: true,
      }),
    );
    const again = await metadata.projects.apply("parcels", { removeUndeclared: false });
    if (again.writes !== 0) throw new Error("Repeated Apply wrote to GitHub");
    console.log(
      JSON.stringify({
        step: "repeat-apply",
        github: "real App",
        writes: again.writes,
        state: again.configuration.state,
      }),
    );
    let duplicate;
    try {
      await graphql(
        'mutation($project:ID!){createProjectV2Field(input:{projectId:$project,dataType:NUMBER,name:"mass"}){projectV2Field{... on ProjectV2Field{id}}}}',
        { project: project.id, headers: { authorization: `token ${pat}` } },
      );
      duplicate = "accepted";
    } catch (error) {
      if (
        !(error instanceof GraphqlResponseError) ||
        !error.errors?.some((e) => /already|unique|exists|duplicate/i.test(e.message))
      )
        throw new Error("Duplicate field-name probe did not produce a conclusive result", {
          cause: error,
        });
      duplicate = "refused";
    }
    console.log(
      JSON.stringify({ step: "duplicate-field-name", github: "real PAT", result: duplicate }),
    );
  } finally {
    await stop?.();
    await github.graph(
      "delete fresh test Project",
      "mutation($id:ID!){deleteProjectV2(input:{projectId:$id}){clientMutationId}}",
      { id: project.id },
    );
    await rm(directory, { recursive: true, force: true });
    console.log(
      JSON.stringify({ step: "fresh-project-cleanup", github: "real PAT", result: "deleted" }),
    );
  }
}
main().catch(() => {
  console.error(
    "Project configuration live check failed; no credential or raw API error is recorded.",
  );
  process.exitCode = 1;
});
