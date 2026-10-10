// ---
// relationships:
//   verifies: [declarations-api, decision-models, blueprints-api]
// ---
import { isPublishConflictResponse } from "@wyrd-company/manifold-shared/declarations-api";
import { expect, test } from "vite-plus/test";
import * as fs from "node:fs/promises";
import git from "isomorphic-git";
import { stringify } from "yaml";
import { startService } from "../service/index.ts";
import { serviceFixture } from "../service/test-fixtures/repository.ts";
const path = "decision-models/quote.yml";
const model = {
  nodes: [
    { id: "in", type: "inputNode" },
    {
      id: "calc",
      type: "customNode",
      content: { kind: "jsonataExpression", config: { expression: '{"price": size * 2}' } },
    },
    { id: "out", type: "outputNode" },
  ],
  edges: [
    { id: "one", sourceId: "in", targetId: "calc" },
    { id: "two", sourceId: "calc", targetId: "out" },
  ],
};
test("model APIs evaluate overlays and publish all changed files in one idempotent commit", async () => {
  const f = await serviceFixture();
  await git.setConfig({ fs, gitdir: f.remote.gitdir, path: "http.receivepack", value: true });
  await fs.writeFile(
    f.file,
    stringify({
      ...f.configuration,
      processRepository: {
        ...f.configuration.processRepository,
        commitAuthor: { name: "Example", email: "example@example.test" },
      },
    }),
  );
  const service = await startService({ configurationFile: f.file, log: () => {} });
  const url = `http://127.0.0.1:${service.http.address().port}/api/declarations`;
  const post = (route: string, body: unknown) =>
    fetch(url + route, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    expect((await fetch(url + "/decision-models")).status).toBe(200);
    const evaluated = await post("/decision-model/evaluate", {
      path,
      text: stringify(model),
      base: f.first,
      input: { size: 3 },
    });
    expect(evaluated.status).toBe(200);
    expect(await evaluated.json()).toMatchObject({
      evaluation: { outcome: "result", result: { price: 6 } },
    });
    const broken = await post("/decision-model/lint", { path, text: "[", base: f.first });
    expect(await broken.json()).toMatchObject({
      findings: [{ file: path, kind: "model-syntax", range: expect.any(Object) }],
    });
    const blueprint = stringify({
      machine: {
        initial: "quote",
        states: {
          quote: { invoke: { src: path, input: { size: 4 }, onDone: "done", onError: "done" } },
          done: { type: "final" },
        },
      },
      schemas: { input: true, output: true, context: true, events: {} },
    });
    const request = {
      base: f.first,
      files: [
        { path: "blueprints/quote.yml", text: blueprint },
        { path, text: stringify(model) },
      ],
      message: "Add sample quote",
      saveId: "1".repeat(32),
    };
    const saved = await post("/publish", request);
    expect(saved.status).toBe(200);
    const result = await saved.json();
    expect(result).toMatchObject({ outcome: "saved", loaded: true });
    expect(await (await post("/publish", request)).json()).toMatchObject({
      outcome: "already-saved",
      commit: result.commit,
    });
    const commits = await git.log({ fs, gitdir: f.remote.gitdir, ref: "main" });
    expect(commits).toHaveLength(2);
    const source = await fetch(url + `/decision-model?path=${path}&commit=${result.commit}`);
    expect(await source.json()).toMatchObject({
      exists: true,
      text: stringify(model),
      commit: result.commit,
    });
    expect(await (await fetch(url + "/decision-models")).json()).toMatchObject({
      models: [{ path, exists: true, intake: false }],
    });
    const invalid = await post("/publish", {
      ...request,
      base: result.commit,
      saveId: "2".repeat(32),
      files: [{ path, text: "[" }],
    });
    expect(invalid.status).toBe(422);
    expect(await git.log({ fs, gitdir: f.remote.gitdir, ref: "main" })).toHaveLength(2);
    const fieldBlueprint = stringify({
      machine: {
        initial: "set",
        states: {
          set: {
            invoke: {
              src: "github-task-field-set",
              input: { field: "Weight", value: 3 },
              onDone: "done",
              onError: "done",
            },
          },
          done: { type: "final" },
        },
      },
      schemas: { input: true, output: true, context: true, events: {} },
    });
    const fieldLint = await fetch(url.replace("/declarations", "/blueprints") + "/lint", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: "blueprints/quote.yml",
        text: fieldBlueprint,
        base: result.commit,
      }),
    });
    expect(await fieldLint.json()).toMatchObject({
      findings: [{ kind: "task-field-value", name: "Weight" }],
    });
    const fieldPublish = await post("/publish", {
      ...request,
      base: result.commit,
      saveId: "5".repeat(32),
      files: [{ path: "blueprints/quote.yml", text: fieldBlueprint }],
    });
    expect(fieldPublish.status).toBe(422);
    expect(await fieldPublish.json()).toMatchObject({
      findings: [{ kind: "task-field-value", name: "Weight" }],
    });
    expect(await git.log({ fs, gitdir: f.remote.gitdir, ref: "main" })).toHaveLength(2);
    for (const files of [
      [{ path: "bindings.yml", text: "" }],
      [
        { path, text: "" },
        { path, text: "" },
      ],
    ])
      expect((await post("/publish", { ...request, files })).status).toBe(400);
  } finally {
    await service.stop();
    await f.close();
  }
}, 30_000);

test("model sources stay at base commits and publications validate reachable intake models without rejecting unrelated edits", async () => {
  const f = await serviceFixture();
  await git.setConfig({ fs, gitdir: f.remote.gitdir, path: "http.receivepack", value: true });
  const service = await startService({ configurationFile: f.file, log: () => {} });
  const url = `http://127.0.0.1:${service.http.address().port}/api/declarations`;
  const post = (route: string, body: unknown) =>
    fetch(url + route, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    const root = {
      nodes: [
        { id: "in", type: "inputNode" },
        { id: "nested", type: "decisionNode", content: { key: "shared/rates.yml" } },
        { id: "out", type: "outputNode" },
      ],
      edges: [
        { id: "one", sourceId: "in", targetId: "nested" },
        { id: "two", sourceId: "nested", targetId: "out" },
      ],
    };
    const seed = await service.revisions.save({
      base: f.first,
      files: [
        { path: "manifold.yml", text: "intake:\n  decisionModel: intake.yml\n" },
        { path: "intake.yml", text: stringify(root) },
        { path: "shared/rates.yml", text: stringify(model) },
      ],
      message: "Add sample intake",
      saveId: "3".repeat(32),
    });
    if (seed.outcome === "conflict") throw new Error("Seed conflict");
    expect(await (await fetch(url + "/decision-models")).json()).toMatchObject({
      intake: "intake.yml",
      models: [{ path: "intake.yml", intake: true, exists: true }],
    });
    expect(
      await (await fetch(url + `/decision-model?path=intake.yml&commit=${f.first}`)).json(),
    ).toMatchObject({ exists: false, text: "", findings: [], warnings: [] });
    const evaluated = await post("/decision-model/evaluate", {
      path: "intake.yml",
      text: stringify(root),
      base: seed.commit,
      models: [{ path: "shared/rates.yml", text: stringify(model) }],
      input: { size: 4 },
    });
    expect(await evaluated.json()).toMatchObject({
      evaluation: { outcome: "result", result: { price: 8 } },
    });
    const invalid = await post("/publish", {
      base: seed.commit,
      files: [{ path: "shared/rates.yml", text: "[" }],
      message: "Bad sample",
      saveId: "4".repeat(32),
    });
    expect(invalid.status).toBe(422);
    expect(
      await (
        await post("/decision-model/evaluate", { path: "shared/rates.yml", text: "[", input: {} })
      ).json(),
    ).toMatchObject({ error: "invalid" });
    const failedModel = structuredClone(model);
    failedModel.nodes[1]!.content = {
      kind: "jsonataExpression",
      config: { expression: '$error("bad sample")' },
    };
    expect(
      await (
        await post("/decision-model/evaluate", {
          path,
          text: stringify(failedModel),
          input: { size: 3 },
        })
      ).json(),
    ).toMatchObject({
      evaluation: { outcome: "error", error: { nodeId: "calc", kind: "evaluation" } },
    });
    for (const body of [
      { path, text: "", base: "bad" },
      { path, text: "", base: "f".repeat(40) },
      { path: "../sample.yml", text: "" },
      { path, text: "", models: [{ path, text: "" }] },
      {
        path,
        text: "",
        models: [
          { path: "shared/rates.yml", text: "" },
          { path: "shared/rates.yml", text: "" },
        ],
      },
    ])
      expect((await post("/decision-model/lint", body)).status).toBe(400);
    expect(
      (await post("/decision-model/evaluate", { path, text: stringify(model), input: [] })).status,
    ).toBe(400);
    const saved = await post("/publish", {
      base: seed.commit,
      files: [{ path: "shared/rates.yml", text: stringify(failedModel) }],
      message: "Change sample",
      saveId: "5".repeat(32),
    });
    expect(saved.status).toBe(200);
    const head = (await saved.json()).commit;
    const conflict = await post("/publish", {
      base: seed.commit,
      files: [{ path: "shared/rates.yml", text: stringify(model) }],
      message: "Concurrent sample",
      saveId: "6".repeat(32),
    });
    expect(conflict.status).toBe(409);
    const conflictBody = await conflict.json();
    expect(isPublishConflictResponse(conflictBody)).toBe(true);
    expect(conflictBody).toMatchObject({
      head,
      files: [{ path: "shared/rates.yml", text: stringify(failedModel) }],
    });
    // A pre-existing error in another reached model is still checked when a valid member changes.
    const broken = await service.revisions.save({
      base: head,
      files: [
        {
          path: "intake.yml",
          text: stringify({
            ...root,
            nodes: [
              ...root.nodes,
              { id: "second", type: "decisionNode", content: { key: "shared/missing.yml" } },
            ],
          }),
        },
      ],
      message: "Incomplete sample",
      saveId: "7".repeat(32),
    });
    if (broken.outcome === "conflict") throw new Error("Conflict");
    const rejected = await post("/publish", {
      base: broken.commit,
      files: [{ path: "shared/rates.yml", text: stringify(model) }],
      message: "Change reached sample",
      saveId: "8".repeat(32),
    });
    expect(rejected.status).toBe(422);
    expect(
      (
        await post("/publish", {
          base: broken.commit,
          files: [{ path: "unrelated.yml", text: stringify(model) }],
          message: "Change unrelated sample",
          saveId: "9".repeat(32),
        })
      ).status,
    ).toBe(200);
  } finally {
    await service.stop();
    await f.close();
  }
});
