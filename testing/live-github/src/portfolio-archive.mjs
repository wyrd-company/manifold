// ---
// relationships:
//   verifies: [declarations-api, process-repository, portfolio-api]
// ---
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { parse, stringify } from "yaml";
import { loadSettings, readCredential, readApp } from "./settings.ts";
import { GitHub } from "./github.ts";
import { serviceConfiguration } from "./configuration.ts";
import { startService } from "../../../packages/service/dist/service/index.js";
// Live verification tooling uses the existing credential resolver. It records
// only checks and commit identities, never credentials or raw API errors.
async function main() {
  const settings = await loadSettings();
  const github = new GitHub(
    settings.organization,
    await readCredential(settings.credentials.patFile),
  );
  const app = await readApp(settings);
  const repository = { owner: settings.organization, repo: settings.processRepository };
  const branch = `sample-archive-${randomUUID()}`;
  const head = await github.rest("read test branch", "GET /repos/{owner}/{repo}/git/ref/{ref}", {
    ...repository,
    ref: "heads/main",
  });
  await github.rest("create archive test branch", "POST /repos/{owner}/{repo}/git/refs", {
    ...repository,
    ref: `refs/heads/${branch}`,
    sha: head.object.sha,
  });
  const directory = await mkdtemp(resolve(".tmp/portfolio-live-"));
  let service;
  try {
    const configuration = serviceConfiguration(settings, directory, { hook: { id: 1 } }, app);
    configuration.processRepository.branch = branch;
    configuration.github.owners[settings.organization].hooks = [];
    const file = resolve(directory, "service.yml");
    await writeFile(file, stringify(configuration));
    service = await startService({ configurationFile: file, log: () => {} });
    const portfolio =
      "# portfolio comment\nitems:\n  alpha:\n    items:\n      beta: {}\n      gamma: {}\n";
    const bindings =
      "# bindings comment\nt3codeProjects:\n  workspace-one: {environment: local, project: workspace-one, item: beta}\n  workspace-two: {environment: local, project: workspace-two, item: beta}\n";
    const seeded = await service.revisions.save({
      base: service.processRepository.current().commit,
      files: [
        { path: "portfolio.yml", text: portfolio },
        { path: "bindings.yml", text: bindings },
      ],
      message: "Declare sample workspaces",
      saveId: randomUUID().replaceAll("-", ""),
    });
    assert.equal(seeded.outcome, "saved");
    const address = service.http.address();
    const url = `http://${address.host}:${address.port}`;
    const request = {
      item: "beta",
      projects: [
        { binding: "workspace-one", choice: "move" },
        { binding: "workspace-two", choice: "reassign", item: "gamma" },
      ],
      base: seeded.commit,
      message: "Archive portfolio item beta",
      saveId: randomUUID().replaceAll("-", ""),
    };
    const save = () =>
      fetch(url + "/api/declarations/archive-item", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
    const response = await save();
    assert.equal(response.status, 200);
    const answer = await response.json();
    assert.equal(answer.outcome, "saved");
    assert.equal(answer.loaded, true);
    const remote = await github.rest(
      "read archive commit",
      "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
      { ...repository, commit_sha: answer.commit },
    );
    assert.deepEqual(
      remote.parents.map((parent) => parent.sha),
      [seeded.commit],
    );
    const current = service.processRepository.current();
    const archivedPortfolio = await current.read("portfolio.yml"),
      archivedBindings = await current.read("bindings.yml");
    assert.ok(archivedPortfolio.includes("# portfolio comment"));
    assert.ok(archivedBindings.includes("# bindings comment"));
    assert.equal(parse(archivedPortfolio).items.alpha.items.beta.archived, true);
    assert.equal(parse(archivedBindings).t3codeProjects["workspace-one"].item, "alpha");
    assert.equal(parse(archivedBindings).t3codeProjects["workspace-two"].item, "gamma");
    const read = await fetch(url + "/api/portfolio").then((response) => response.json());
    assert.equal(read.commit, answer.commit);
    assert.equal(read.items.find((item) => item.id === "beta").archived, true);
    const retry = await save();
    assert.equal(retry.status, 200);
    assert.deepEqual(await retry.json(), {
      outcome: "already-saved",
      commit: answer.commit,
      loaded: true,
    });
    const final = await github.rest(
      "read final archive branch",
      "GET /repos/{owner}/{repo}/git/ref/{ref}",
      { ...repository, ref: `heads/${branch}` },
    );
    assert.equal(final.object.sha, answer.commit);
    console.log(
      JSON.stringify({
        step: "archive-save",
        result: "passed",
        base: seeded.commit,
        commit: answer.commit,
        files: 2,
        retry: "same commit",
      }),
    );
  } finally {
    await service?.stop();
    await github.rest("delete archive test branch", "DELETE /repos/{owner}/{repo}/git/refs/{ref}", {
      ...repository,
      ref: `heads/${branch}`,
    });
    await rm(directory, { recursive: true, force: true });
    console.log(
      JSON.stringify({ step: "archive-cleanup", result: "deleted test branch and local store" }),
    );
  }
}
main().catch(() => {
  console.error("Portfolio archive live check failed; no credential or raw API error is recorded.");
  process.exitCode = 1;
});
