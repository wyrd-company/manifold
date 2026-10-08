// ---
// relationships:
//   verifies: [projects-api, task-metadata, github-event-source, process-repository]
// ---
import * as fs from "node:fs/promises";
import git from "isomorphic-git";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { Ajv2020 } from "ajv/dist/2020.js";
import { expect, test } from "vite-plus/test";
import { childProcessLimit } from "../../../../test-support/limits.ts";
import { serviceFixture } from "../service/test-fixtures/repository.ts";
import { startService } from "../service/index.ts";
const asset = parse(
  readFileSync(
    new URL("../../../../docs/specifications/projects-api.openapi.yml", import.meta.url),
    "utf8",
  ),
) as Record<string, unknown>;
const ajv = new Ajv2020({ strict: false });
ajv.addSchema({ ...asset, $id: "https://example.test/projects-api" });
const validators = new Map<string, ReturnType<typeof ajv.compile>>();
function agrees(schema: string, value: unknown) {
  let validate = validators.get(schema);
  if (!validate) {
    validate = ajv.compile({
      $ref: `https://example.test/projects-api#/components/schemas/${schema}`,
    });
    validators.set(schema, validate);
  }
  expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
}
const declaration = {
  projects: {
    parcels: {
      lifecycle: { field: "Stage", options: ["Packed", "Sent"] },
      fields: {
        mass: {
          type: "number",
          whenChanged: "accept",
          storage: { kind: "project-field", name: "Mass" },
        },
        note: { type: "text" },
      },
    },
  },
};
const bindings = {
  githubProjects: { parcels: { owner: "sample", number: 1, environment: "local", item: "alpha" } },
};
test("Projects API observes drift, converges, keeps ids, accepts through a real repository save", async () => {
  const f = await serviceFixture();
  let service: Awaited<ReturnType<typeof startService>> | undefined;
  try {
    f.api.fields.splice(0);
    await git.setConfig({ fs, gitdir: f.remote.gitdir, path: "http.receivepack", value: "true" });
    await f.commit(60, { bindings, taskMetadata: declaration });
    let refuseAcceptanceFollow = true;
    service = await startService({
      configurationFile: f.file,
      probes: {
        save(step) {
          if (step === "pushed" && refuseAcceptanceFollow) {
            refuseAcceptanceFollow = false;
            f.remote.state.refuseNextFetch = true;
          }
        },
      },
      log: (entry) => {
        if (entry.event === "github-error" || entry.event === "portfolio-rejected")
          console.error(JSON.stringify(entry));
      },
    });
    await expect
      .poll(() => service!.github.projectByNumber("sample", 1), { timeout: childProcessLimit })
      .toBeDefined();
    const url = `http://${service.http.address().host}:${service.http.address().port}/api/projects`;
    const get = async (path = "") => {
      const value = await (await fetch(url + path)).json();
      agrees(path === "" ? "ProjectsResponse" : "PlanResponse", value);
      return value;
    };
    const apply = async (body: unknown) => {
      const response = await fetch(url + "/parcels/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const answer = await response.json();
      agrees(
        response.status === 200
          ? "ApplyResponse"
          : response.status === 502
            ? "ApplyFailedResponse"
            : "ErrorResponse",
        answer,
      );
      return { status: response.status, body: answer };
    };
    expect(await get()).toMatchObject({
      projects: [{ binding: "parcels", configuration: { state: "not-applied" } }],
    });
    const before = await get("/parcels/plan");
    expect(before).toMatchObject({
      observation: { status: "fresh" },
      changes: [{ action: "create" }, { action: "create" }, { action: "create" }],
    });
    f.api.failQuery("GitHubProjectFields", "FORBIDDEN");
    const unavailable = await apply({ removeUndeclared: false });
    expect(unavailable).toMatchObject({ status: 502, body: { writes: 0, changes: [] } });
    const invalid = await apply({ removeUndeclared: false, unexpected: true });
    expect(invalid.status).toBe(400);
    expect((await apply({ removeUndeclared: false })).body).toMatchObject({
      writes: 3,
      configuration: { state: "in-sync" },
    });
    expect((await apply({ removeUndeclared: false })).body).toMatchObject({
      writes: 0,
      outcome: "in-sync",
    });
    const stage = f.api.fields.find((f) => f.name === "Stage")!;
    const option = stage.options[0]!;
    const originalId = option.id;
    option.name = "Ready";
    expect(await get("/parcels/plan")).toMatchObject({
      configuration: { state: "drift", count: 1 },
      changes: [{ drift: true, target: { lifecycle: true, option: "Packed" } }],
    });
    expect((await apply({ removeUndeclared: false, digest: before.digest })).status).toBe(409);
    expect((await apply({ removeUndeclared: false })).body).toMatchObject({
      writes: 1,
      configuration: { state: "in-sync" },
    });
    expect(f.api.fields.find((f) => f.name === "Stage")!.options[0]!.id).toBe(originalId);
    f.api.fields.find((f) => f.name === "Mass")!.name = "Weight";
    let accepted = await apply({ removeUndeclared: false });
    if (accepted.status === 409) {
      expect(accepted.body.error).toMatchObject({
        kind: "declaration-pending",
        commit: expect.any(String),
      });
      await expect
        .poll(
          async () => {
            accepted = await apply({ removeUndeclared: false });
            if (accepted.status === 409)
              expect(accepted.body.error.kind).toBe("declaration-pending");
            return accepted.status;
          },
          { timeout: childProcessLimit },
        )
        .toBe(200);
    }
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
    expect(accepted.body).toMatchObject({ writes: 0, configuration: { state: "in-sync" } });
    expect(await service.processRepository.current()!.read("task-metadata.yml")).toContain(
      "Weight",
    );
    expect((await apply({ removeUndeclared: false })).body).toMatchObject({
      writes: 0,
      outcome: "in-sync",
    });
    expect((await fetch(url + "/parcels/apply")).status).toBe(405);
  } finally {
    await service?.stop();
    await f.close();
  }
});
test("push succeeds, follow fails: retries and restart keep one accept commit and the earlier baseline", async () => {
  const f = await serviceFixture();
  let service: Awaited<ReturnType<typeof startService>> | undefined;
  try {
    f.api.fields.splice(0);
    await git.setConfig({ fs, gitdir: f.remote.gitdir, path: "http.receivepack", value: "true" });
    const initial = await f.commit(60, { bindings, taskMetadata: declaration });
    service = await startService({
      configurationFile: f.file,
      log: () => {},
      probes: {
        save(step) {
          if (step === "pushed") f.remote.state.refuseNextFetch = true;
        },
      },
    });
    await expect
      .poll(() => service!.github.projectByNumber("sample", 1), { timeout: childProcessLimit })
      .toBeDefined();
    const apply = async () => {
      const address = service!.http.address();
      const response = await fetch(
        `http://${address.host}:${address.port}/api/projects/parcels/apply`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: '{"removeUndeclared":false}',
        },
      );
      const body = await response.json();
      agrees(response.status === 200 ? "ApplyResponse" : "ErrorResponse", body);
      return { status: response.status, body };
    };
    expect((await apply()).status).toBe(200);
    f.api.fields.find((f) => f.name === "Mass")!.name = "Weight";
    const pending = await apply();
    expect(pending).toMatchObject({
      status: 409,
      body: { error: { kind: "declaration-pending", commit: expect.any(String) } },
    });
    const row = service.store.connection.database
      .prepare("SELECT commit_id FROM metadata_project_applies")
      .get();
    expect(row?.["commit_id"]).toBe(initial);
    f.remote.state.refuseNextFetch = true;
    expect((await apply()).body).toEqual(pending.body);
    const commits = await git.log({ fs, gitdir: f.remote.gitdir, ref: "main" });
    expect(
      commits.filter((c) => c.commit.message.startsWith("Accept GitHub changes")),
    ).toHaveLength(1);
    await service.stop();
    service = await startService({ configurationFile: f.file, log: () => {} });
    expect(await service.processRepository.current()!.read("task-metadata.yml")).toContain(
      "Weight",
    );
    expect((await apply()).body).toMatchObject({ writes: 0, configuration: { state: "in-sync" } });
    expect(
      (await git.log({ fs, gitdir: f.remote.gitdir, ref: "main" })).filter((c) =>
        c.commit.message.startsWith("Accept GitHub changes"),
      ),
    ).toHaveLength(1);
    expect(
      service.store.connection.database
        .prepare("SELECT count(*) AS n FROM metadata_pending_saves")
        .get()?.["n"],
    ).toBe(0);
  } finally {
    await service?.stop();
    await f.close();
  }
});

test("pull fails before the first accept save: no accept commit reaches the remote", async () => {
  const f = await serviceFixture();
  let service: Awaited<ReturnType<typeof startService>> | undefined;
  let sweep: ReturnType<typeof f.remote.holdNext> | undefined;
  const backgroundErrors: unknown[] = [];
  try {
    f.api.fields.splice(0);
    await git.setConfig({ fs, gitdir: f.remote.gitdir, path: "http.receivepack", value: "true" });
    const initial = await f.commit(60, { bindings, taskMetadata: declaration });
    service = await startService({
      configurationFile: f.file,
      log: (entry) => {
        if (entry.event === "github-error") backgroundErrors.push(entry);
      },
      probes: {
        step(step) {
          if (step === "pulled") sweep = f.remote.holdNext();
        },
      },
    });
    // Keep the first sweep's pull pending while the Project becomes visible.
    await sweep!.reached;
    await expect
      .poll(() => service!.github.projectByNumber("sample", 1), { timeout: childProcessLimit })
      .toBeDefined();
    const address = service.http.address();
    const apply = () =>
      fetch(`http://${address.host}:${address.port}/api/projects/parcels/apply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"removeUndeclared":false}',
      });
    expect((await apply()).status).toBe(200);
    f.api.fields.find((field) => field.name === "Mass")!.name = "Weight";
    sweep!.release();
    // Project visibility does not mean its sweep pull has finished. Queue a pull
    // behind it so the one-shot refusal belongs to the accept save.
    await service.processRepository.pull();
    f.remote.state.refuseNextFetch = true;
    const response = await apply();
    const body = await response.json();
    expect(backgroundErrors).toHaveLength(0);
    expect(response.status, JSON.stringify(body)).toBe(502);
    agrees("ApplyFailedResponse", body);
    expect(body).toMatchObject({ error: { kind: "declaration-unsaved" }, writes: 0 });
    const commits = await git.log({ fs, gitdir: f.remote.gitdir, ref: "main" });
    expect(commits[0]!.oid).toBe(initial);
    expect(
      commits.filter((commit) => commit.commit.message.startsWith("Accept GitHub changes")),
    ).toHaveLength(0);
  } finally {
    sweep?.release();
    await service?.stop();
    await f.close();
  }
});
