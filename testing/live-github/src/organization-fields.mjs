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
  const original = "Sample instructions.\n";
  const createdFields = [];
  let createdType;
  let cleanupGithub;
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
  let cleanupFailed = false;
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
    const cleanupToken = await configuration.credentials.resolve("reader").installationToken({});
    cleanupGithub = new GitHub(settings.organization, cleanupToken.reveal());
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
    const organization = settings.organization;
    const observed = await source.observeScope({ kind: "organization", organization });
    if (observed.status !== "ready")
      throw new Error(`Organization observation: ${observed.status}`);
    console.log(JSON.stringify({ step: "organization-read", result: "passed" }));
    const field = await source.writeScopeEntity({
      kind: "issue-field-create",
      organization,
      name: `Sample priority ${randomUUID().slice(0, 8)}`,
      type: "single-select",
      options: [
        { name: "Normal", color: "gray", description: "" },
        { name: "High", color: "blue", description: "" },
      ],
    });
    createdFields.push(field.nodeId);
    const ids = field.options.map((o) => o.id);
    const changed = await source.writeScopeEntity({
      kind: "issue-field-update",
      organization,
      nodeId: field.nodeId,
      options: field.options.map((o, i) => ({ ...o, name: i === 1 ? "Elevated" : o.name })),
    });
    if (JSON.stringify(changed.options.map((o) => o.id)) !== JSON.stringify(ids))
      throw new Error("REST update changed option ids");
    console.log(
      JSON.stringify({ step: "rest-option-identity", result: "passed", idsPreserved: true }),
    );
    createdType = await source.writeScopeEntity({
      kind: "issue-type-create",
      organization,
      name: `Sample type ${randomUUID().slice(0, 8)}`,
      color: "green",
      description: "Sample type",
    });
    await source.writeScopeEntity({
      kind: "issue-type-update",
      organization,
      nodeId: createdType.nodeId,
      description: "Updated sample type",
      enabled: true,
    });
    const write = {
      actorId: "sample",
      invokeId: "field",
      entryId: "set",
      issueNodeId: issueId,
      projectNodeId: project.id,
      field: "priority",
      storage: { kind: "issue-field", organization, name: field.name },
      labels: [],
      repositories: [],
      value: "Elevated",
    };
    await source.writeTaskField(write);
    await source.writeTaskField(write);
    await source.writeTaskField({
      ...write,
      invokeId: "type",
      field: "category",
      storage: { kind: "issue-type", organization },
      value: createdType.name,
    });
    const check = await github.graph(
      "read organization values",
      "query($id:ID!){node(id:$id){... on Issue{issueType{id} issueFieldValues(first:50){nodes{... on IssueFieldSingleSelectValue{optionId name}}}}}}",
      { id: issueId },
    );
    if (
      check.node.issueType.id !== createdType.nodeId ||
      !check.node.issueFieldValues.nodes.some((v) => v.name === "Elevated" && v.optionId === ids[1])
    )
      throw new Error("Organization values differ");
    console.log(
      JSON.stringify({
        step: "organization-values-set-replay",
        result: "passed",
        appIssueTypeWrite: true,
      }),
    );
    await source.writeTaskField({ ...write, entryId: "clear", value: null });
    await source.writeTaskField({ ...write, entryId: "clear", value: null });
    await source.writeTaskField({
      ...write,
      entryId: "clear-type",
      invokeId: "type",
      field: "category",
      storage: { kind: "issue-type", organization },
      value: null,
    });
    console.log(JSON.stringify({ step: "organization-values-clear", result: "passed" }));
    // A permission-limited token tests the platform requirement without changing App grants.
    const { createAppAuth } = await import("@octokit/auth-app");
    const auth = createAppAuth({
      appId: app.appId,
      installationId: app.installationId,
      privateKey: await readCredential(settings.credentials.appPrivateKeyFile),
    });
    const limited = await auth({ type: "installation", permissions: { issues: "write" } });
    const { graphql } = await import("@octokit/graphql");
    let typePermission;
    try {
      await graphql(
        "mutation($issue:ID!,$type:ID!){updateIssueIssueType(input:{issueId:$issue,issueTypeId:$type}){issue{id}}}",
        {
          issue: issueId,
          type: createdType.nodeId,
          headers: { authorization: `token ${limited.token}` },
        },
      );
      typePermission = "issues-write-sufficient";
    } catch {
      typePermission = "issues-only-refused";
    }
    console.log(
      JSON.stringify({
        step: "issue-type-permission",
        result: typePermission,
        fullAppSucceeded: true,
      }),
    );
  } finally {
    await stop?.();
    const cleanup = await Promise.allSettled([
      ...createdFields.map((id) =>
        cleanupGithub.graph(
          "delete fresh issue field",
          "mutation($id:ID!){deleteIssueField(input:{fieldId:$id}){clientMutationId}}",
          { id },
        ),
      ),
      ...(createdType
        ? [
            cleanupGithub.graph(
              "delete fresh issue type",
              "mutation($id:ID!){deleteIssueType(input:{issueTypeId:$id}){clientMutationId}}",
              { id: createdType.nodeId },
            ),
          ]
        : []),
      github.graph(
        "delete fresh body test issue",
        "mutation($id:ID!){deleteIssue(input:{issueId:$id}){clientMutationId}}",
        { id: issueId },
      ),
      github.graph(
        "delete fresh test Project",
        "mutation($id:ID!){deleteProjectV2(input:{projectId:$id}){clientMutationId}}",
        { id: project.id },
      ),
      rm(directory, { recursive: true, force: true }),
    ]);
    cleanupFailed = cleanup.some((result) => result.status === "rejected");
    console.log(
      JSON.stringify({
        step: "fresh-project-cleanup",
        github: "real PAT",
        result: cleanupFailed ? "failed" : "deleted",
      }),
    );
  }
  if (cleanupFailed) throw Error("Fresh organization probe cleanup failed");
}
main().catch((error) => {
  console.error(JSON.stringify({ kind: error.kind ?? error.name, message: error.message }));
  console.error("Organization live check failed; no credential or raw API error is recorded.");
  process.exitCode = 1;
});
