// ---
// relationships:
//   verifies: [task-metadata, github-event-source]
// ---
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { stringify } from "yaml";
import { loadSettings, readCredential, readApp } from "./settings.ts";
import { GitHub } from "./github.ts";
import { loadServiceConfiguration } from "../../../packages/service/dist/service-configuration/index.js";
import { createRepositoryFields } from "../../../packages/service/dist/github-repository-fields/index.js";
async function main() {
  const settings = await loadSettings();
  const github = new GitHub(
    settings.organization,
    await readCredential(settings.credentials.patFile),
  );
  const directory = await mkdtemp(join(tmpdir(), "repository-fields-live-"));
  const repository = `${settings.organization}/${settings.repository}`;
  const prefix = `sample-${randomUUID()}: `;
  const title = `Sample milestone ${randomUUID()}`;
  const labels = [];
  const milestones = [];
  let adapter;
  let issue;
  try {
    const configFile = join(directory, "service.yml");
    await writeFile(
      configFile,
      stringify({
        store: { file: join(directory, "state.sqlite") },
        credentials: {
          reader: {
            kind: "github-app",
            ...(await readApp(settings)),
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
    adapter = createRepositoryFields({
      configuration: configuration.github,
      credentials: configuration.credentials,
    });
    const scope = { kind: "repository", repository };
    const label = await adapter.writeScopeEntity({
      kind: "label-create",
      repository,
      name: prefix + "Small",
      color: "aabbcc",
      description: "Compact",
    });
    labels.push(label);
    let duplicateLabelRefused = false;
    try {
      labels.push(
        await adapter.writeScopeEntity({
          kind: "label-create",
          repository,
          name: (prefix + "Small").toUpperCase(),
          color: "aabbcc",
          description: "",
        }),
      );
    } catch (error) {
      if (error.kind !== "rejected" || error.status !== 422) throw error;
      duplicateLabelRefused = true;
    }
    if (!duplicateLabelRefused)
      throw new Error("GitHub accepted label names differing only by case");
    console.log(JSON.stringify({ step: "label-case-uniqueness", result: "passed", status: 422 }));
    await adapter.writeScopeEntity({
      kind: "label-update",
      repository,
      nodeId: label.nodeId,
      name: prefix + "Tiny",
      color: "ddeeff",
      description: "Tiny",
    });
    const milestone = await adapter.writeScopeEntity({
      kind: "milestone-create",
      repository,
      title,
      description: "Season",
    });
    milestones.push(milestone);
    let duplicateMilestoneRefused = false;
    try {
      milestones.push(
        await adapter.writeScopeEntity({
          kind: "milestone-create",
          repository,
          title,
          description: "",
        }),
      );
    } catch (error) {
      if (error.kind !== "rejected" || error.status !== 422) throw error;
      duplicateMilestoneRefused = true;
    }
    if (!duplicateMilestoneRefused)
      throw new Error("GitHub accepted duplicate milestone titles in one repository");
    console.log(
      JSON.stringify({ step: "milestone-title-uniqueness", result: "passed", status: 422 }),
    );
    await adapter.writeScopeEntity({
      kind: "milestone-update",
      repository,
      number: milestone.number,
      title: title + " revised",
      description: "Revised",
    });
    const observed = await adapter.observeScope(scope);
    if (
      observed.status !== "ready" ||
      !observed.labels.some((l) => l.nodeId === label.nodeId && l.name === prefix + "Tiny") ||
      !observed.milestones.some(
        (m) => m.nodeId === milestone.nodeId && m.title === title + " revised",
      )
    )
      throw new Error("Renamed entities did not retain identity");
    issue = await github.rest(
      "create repository field test issue",
      "POST /repos/{owner}/{repo}/issues",
      {
        repo: settings.repository,
        title: `Sample fields ${randomUUID()}`,
        body: "Generic instructions.\n",
      },
    );
    const tracked = {
      issue: {
        nodeId: issue.node_id,
        repository,
        number: issue.number,
        state: "open",
        stateReason: null,
      },
      items: [],
      projects: [],
      blockedBy: [],
      blocking: [],
      subIssues: [],
      parent: undefined,
    };
    const write = {
      actorId: "parcel",
      invokeId: "size",
      entryId: "entry",
      issueNodeId: issue.node_id,
      projectNodeId: "P_sample",
      field: "size",
      storage: { kind: "label", prefix },
      labels: [prefix + "Tiny"],
      repositories: [repository],
      value: "Tiny",
    };
    await adapter.writeTaskField(write, tracked);
    await adapter.writeTaskField(write, tracked);
    const value = await github.rest(
      "read label test issue",
      "GET /repos/{owner}/{repo}/issues/{issue_number}",
      { repo: settings.repository, issue_number: issue.number },
    );
    if (!value.labels.some((l) => l.node_id === label.nodeId))
      throw new Error("Label assignment failed");
    await adapter.writeTaskField(
      { ...write, storage: { kind: "milestone" }, value: title + " revised" },
      tracked,
    );
    await adapter.writeTaskField(
      { ...write, storage: { kind: "milestone" }, value: title + " revised" },
      tracked,
    );
    const assigned = await github.rest(
      "read milestone test issue",
      "GET /repos/{owner}/{repo}/issues/{issue_number}",
      { repo: settings.repository, issue_number: issue.number },
    );
    if (assigned.milestone?.node_id !== milestone.nodeId)
      throw new Error("Milestone assignment failed");
    await adapter.writeTaskField({ ...write, value: null }, tracked);
    await adapter.writeTaskField(
      { ...write, storage: { kind: "milestone" }, value: null },
      tracked,
    );
    const cleared = await github.rest(
      "read cleared test issue",
      "GET /repos/{owner}/{repo}/issues/{issue_number}",
      { repo: settings.repository, issue_number: issue.number },
    );
    if (cleared.labels.length || cleared.milestone !== null)
      throw new Error("Clearing repository fields failed");
    console.log(
      JSON.stringify({
        step: "repository-fields-create-rename-set-replay-clear",
        github: "real App",
        result: "passed",
      }),
    );
  } finally {
    if (issue)
      await github.graph(
        "delete field test issue",
        "mutation($id:ID!){deleteIssue(input:{issueId:$id}){clientMutationId}}",
        { id: issue.node_id },
      );
    for (const label of labels)
      await adapter.writeScopeEntity({ kind: "label-delete", repository, nodeId: label.nodeId });
    for (const milestone of milestones)
      await github.rest(
        "delete field test milestone",
        "DELETE /repos/{owner}/{repo}/milestones/{milestone_number}",
        { repo: settings.repository, milestone_number: milestone.number },
      );
    adapter?.stop();
    await rm(directory, { recursive: true, force: true });
    console.log(JSON.stringify({ step: "fresh-repository-fields-cleanup", result: "deleted" }));
  }
}
main().catch(() => {
  console.error("Repository field live check failed; no raw API response logged");
  process.exitCode = 1;
});
