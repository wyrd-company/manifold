// ---
// relationships:
//   verifies: [task-metadata, github-event-source]
// ---
// Live verification tooling. Credentials are read only by the existing live
// tooling and credential resolver; no credential or raw API error is logged.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { stringify } from "yaml";
import { loadSettings, readCredential, readApp } from "./settings.ts";
import { GitHub } from "./github.ts";
import { loadServiceConfiguration } from "../../../packages/service/dist/service-configuration/index.js";
import { openStore } from "../../../packages/service/dist/store/index.js";
import { startRouter } from "../../../packages/service/dist/router/index.js";
import { startGitHubSource } from "../../../packages/service/dist/github-source/index.js";
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
  const repository = await github.graph(
    "read test repository",
    "query($owner:String!,$name:String!){repository(owner:$owner,name:$name){id}}",
    { owner: settings.organization, name: settings.repository },
  );
  const original = "Parcel instructions.\n";
  const createdIssue = await github.graph(
    "create fresh body test issue",
    "mutation($repository:ID!,$title:String!,$body:String!){createIssue(input:{repositoryId:$repository,title:$title,body:$body}){issue{id}}}",
    { repository: repository.repository.id, title: `Sample body ${randomUUID()}`, body: original },
  );
  const issueId = createdIssue.createIssue.issue.id;
  await github.graph(
    "add body test issue",
    "mutation($project:ID!,$issue:ID!){addProjectV2ItemById(input:{projectId:$project,contentId:$issue}){item{id}}}",
    { project: project.id, issue: issueId },
  );
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
          JSON.stringify({
            event: "source-error",
            kind: error.kind,
            message: error.message,
            status: error.status,
          }),
        );
      },
    });
    stop = async () => {
      await source.stop();
      router.stop();
      store.close();
    };
    for (let attempt = 0; attempt < 300 && !source.trackedIssue(issueId)?.content; attempt++) {
      source.requestSweep();
      await delay(100);
    }
    console.log(
      JSON.stringify({
        step: "mirror-state",
        project: !!source.projectByNumber(settings.organization, project.number),
        issues: source.trackedIssues().length,
        content: !!source.trackedIssue(issueId)?.content,
      }),
    );
    if (!source.trackedIssue(issueId)?.content)
      throw new Error("Fresh issue content was not mirrored");
    const write = {
      actorId: "parcel",
      invokeId: "due",
      entryId: "entry",
      projectNodeId: project.id,
      issueNodeId: issueId,
      field: "Due",
      storage: { kind: "front-matter", key: "due" },
      labels: [],
      repositories: [],
      value: "2026-01-02",
    };
    // GitHub can expose the body before its edit history. Replaying the invocation
    // after the history arrives must finish its pending check before equality.
    async function writeAndCheck(command) {
      try {
        await source.writeTaskField(command);
      } catch (error) {
        if (error.kind !== "transport") throw error;
        await delay(1100);
        await source.writeTaskField(command);
      }
    }
    await writeAndCheck(write);
    await source.writeTaskField(write);
    const readBody = async () =>
      (
        await github.graph(
          "read body test issue",
          "query($id:ID!){node(id:$id){... on Issue{body}}}",
          { id: issueId },
        )
      ).node.body;
    if (!(await readBody()).includes(original)) throw new Error("Write did not preserve prose");
    console.log(
      JSON.stringify({ step: "front-matter-set-replay", github: "real App", result: "passed" }),
    );
    // A second timestamp is required only by this probe to distinguish GitHub's edit timestamps.
    await delay(1100);
    await writeAndCheck({ ...write, entryId: "clear", value: null });
    if ((await readBody()) !== original) throw new Error("Clear did not preserve prose");
    console.log(
      JSON.stringify({ step: "front-matter-clear", github: "real App", result: "passed" }),
    );
    const history = await github.graph(
      "read content edit capabilities",
      "query($id:ID!){node(id:$id){... on Issue{userContentEdits(first:100){nodes{editedAt diff}}}}}",
      { id: issueId },
    );
    console.log(
      JSON.stringify({
        step: "edit-history",
        entries: history.node.userContentEdits.nodes.length,
        fullBodyAvailable: history.node.userContentEdits.nodes.some(
          (edit) => edit.diff === original,
        ),
      }),
    );
  } finally {
    await stop?.();
    await github.graph(
      "delete fresh body test issue",
      "mutation($id:ID!){deleteIssue(input:{issueId:$id}){clientMutationId}}",
      { id: issueId },
    );
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
main().catch((error) => {
  console.error(JSON.stringify({ kind: error.kind ?? error.name, message: error.message }));
  console.error("Front matter live check failed; no credential or raw API error is recorded.");
  process.exitCode = 1;
});
