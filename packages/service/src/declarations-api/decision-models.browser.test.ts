// ---
// relationships:
//   verifies: [operator-console, declarations-api, decision-models]
// ---
import { chromium } from "playwright";
import type { Page } from "playwright";
import * as fs from "node:fs/promises";
import git from "isomorphic-git";
import { createActor, toPromise } from "xstate";
import { parse, stringify } from "yaml";
import { expect, test } from "vite-plus/test";
import { childProcessLimit } from "../../../../test-support/limits.ts";
import { serviceFixture } from "../service/test-fixtures/repository.ts";
import { startService } from "../service/index.ts";
const path = "decision-models/quote.yml",
  blueprintPath = "blueprints/quote.yml";
const model = {
  nodes: [
    { id: "in", type: "inputNode" },
    {
      id: "table",
      name: "Quote",
      type: "customNode",
      content: {
        kind: "jsonataDecisionTable",
        config: {
          hitPolicy: "first",
          inputs: [{ id: "size", name: "Size", field: "size" }],
          outputs: [{ id: "price", name: "Price", field: "price" }],
          rules: [{ _id: "rule", size: "$ >= 1", price: "5" }],
        },
      },
    },
    {
      id: "adjust",
      name: "Adjust",
      type: "customNode",
      content: {
        kind: "jsonataExpression",
        config: { expression: '{"price": price + 2}' },
      },
    },
    { id: "out", type: "outputNode" },
  ],
  edges: [
    { id: "one", sourceId: "in", targetId: "table" },
    { id: "two", sourceId: "table", targetId: "adjust" },
    { id: "three", sourceId: "adjust", targetId: "out" },
  ],
};
const blueprint = stringify({
  machine: {
    initial: "quoting",
    context: {},
    states: {
      quoting: {
        invoke: {
          src: path,
          input: { size: 3 },
          onDone: {
            target: "done",
            actions: {
              type: "expression.assign",
              params: { expression: '{"answer": event.output}' },
            },
          },
          onError: "done",
        },
      },
      done: {
        type: "final",
        output: { type: "expression.map", params: { expression: "context" } },
      },
    },
  },
  schemas: {
    input: true,
    output: true,
    context: true,
    events: {},
    actors: { [path]: { input: true, output: true } },
  },
});
const intake = stringify({
  nodes: [
    { id: "in", type: "inputNode" },
    {
      id: "nested",
      type: "decisionNode",
      content: { key: "shared/rates.yml" },
    },
    { id: "out", type: "outputNode" },
  ],
  edges: [
    { id: "one", sourceId: "in", targetId: "nested" },
    { id: "two", sourceId: "nested", targetId: "out" },
  ],
});
async function fixture(dark: boolean) {
  const f = await serviceFixture();
  await git.setConfig({
    fs,
    gitdir: f.remote.gitdir,
    path: "http.receivepack",
    value: true,
  });
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
  const service = await startService({
    configurationFile: f.file,
    log: () => {},
  });
  const url = `http://127.0.0.1:${service.http.address().port}`;
  const seed = await service.revisions.save({
    base: f.first,
    files: [
      { path: blueprintPath, text: blueprint },
      { path, text: stringify(model) },
      { path: "manifold.yml", text: "intake:\n  decisionModel: intake.yml\n" },
      { path: "intake.yml", text: intake },
      { path: "shared/rates.yml", text: stringify(model) },
    ],
    message: "Add sample process",
    saveId: "1".repeat(32),
  });
  if (seed.outcome === "conflict") throw new Error("Seed conflict");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  page.setDefaultTimeout(childProcessLimit);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors: string[] = [],
    requests: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  await page.addInitScript(
    (value) => localStorage.setItem("manifold.theme", value),
    dark ? "dark" : "light",
  );
  await page.goto(url + "/console/blueprints/" + blueprintPath);
  return {
    f,
    service,
    url,
    page,
    errors,
    requests,
    seed: seed.commit,
    async close() {
      await browser.close();
      await service.stop();
      await f.close();
    },
  };
}
const dialog = (page: Page) => page.getByRole("dialog", { name: "Decision model", exact: true });
async function open(page: Page) {
  await page.locator(".canvas-state").getByText("quoting", { exact: true }).click();
  await page.getByRole("button", { name: "Open decision model", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Add rule", exact: true }).waitFor();
}
async function edit(page: Page, value: string) {
  await open(page);
  await dialog(page).getByLabel("Price JSONata rule 1", { exact: true }).fill(value);
  await dialog(page).getByRole("button", { name: "Apply to draft", exact: true }).click();
}
async function publish(page: Page) {
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByLabel("Commit message").fill("Adjust sample quote");
  await page.getByRole("button", { name: "Commit and push", exact: true }).click();
  await page
    .locator(".success-text")
    .filter({ hasText: /^Saved as |^Already saved/ })
    .waitFor();
}
async function stored(page: Page) {
  return page.evaluate(() => {
    const text = localStorage.getItem("manifold.blueprint-draft.blueprints/quote.yml");
    return text ? JSON.parse(text) : undefined;
  });
}
function origins(f: Awaited<ReturnType<typeof fixture>>) {
  expect(f.errors).toEqual([]);
  expect(f.requests.every((url) => new URL(url).origin === f.url)).toBe(true);
}
for (const dark of [false, true]) {
  test(
    `built editor stages and retains rules and columns in ${dark ? "dark" : "light"} theme under CSP`,
    async () => {
      const f = await fixture(dark);
      const { page } = f;
      try {
        expect(f.requests.some((url) => url.includes("DecisionModelDialog"))).toBe(false);
        await page.locator(".canvas-state").getByText("quoting", { exact: true }).click();
        await page.getByRole("button", { name: "Choose implementation", exact: true }).click();
        await page.getByText("Decide", { exact: true }).waitFor();
        await page.getByRole("option").filter({ hasText: path }).click();
        await open(page);
        expect(
          f.requests.some((url) => url.includes("DecisionModelDialog") && url.endsWith(".js")),
        ).toBe(true);
        await dialog(page).getByRole("button", { name: "Add rule", exact: true }).click();
        await dialog(page).getByLabel("Size JSONata rule 1", { exact: true }).fill("$ >= 2");
        await dialog(page).getByLabel("Price JSONata rule 1", { exact: true }).fill("8");
        await dialog(page).getByRole("button", { name: "Add input", exact: true }).click();
        await dialog(page).getByRole("button", { name: "Add output", exact: true }).click();
        await dialog(page).getByRole("button", { name: "YAML", exact: true }).click();
        const code = dialog(page).locator(".blueprint-code .cm-content");
        await dialog(page).getByRole("button", { name: "Copy", exact: true }).click();
        const expanded = parse(await page.evaluate(() => navigator.clipboard.readText()));
        const config = expanded.nodes[1].content.config;
        config.inputs[1].field = "weight";
        config.outputs[1].field = "extra";
        for (const rule of config.rules) rule[config.outputs[1].id] = "0";
        await code.press("ControlOrMeta+a");
        await page.keyboard.insertText(stringify(expanded));
        await dialog(page).getByRole("button", { name: "Apply to draft", exact: true }).click();
        await page.getByText(/2 rules · first/).waitFor();
        await page.reload();
        await open(page);
        expect(
          await dialog(page).getByLabel("Price JSONata rule 1", { exact: true }).innerText(),
        ).toBe("8");
        const savedModel = parse((await stored(page)).models[path].text);
        expect(savedModel.nodes[1].content.config.inputs).toHaveLength(2);
        expect(savedModel.nodes[1].content.config.outputs).toHaveLength(2);
        origins(f);
      } finally {
        await f.close();
      }
    },
    childProcessLimit,
  );
  test(
    `built editor keeps staged edits through lint and evaluation failures and discard (${dark ? "dark" : "light"})`,
    async () => {
      const f = await fixture(dark);
      const { page } = f;
      try {
        await edit(page, "8");
        await page.reload();
        await open(page);
        await page.route("**/api/declarations/decision-model/lint", (route) =>
          route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ error: "unavailable", message: "Sample failure" }),
          }),
        );
        await dialog(page).getByLabel("Price JSONata rule 1", { exact: true }).fill("99");
        await dialog(page).getByRole("alert").filter({ hasText: "Sample failure" }).waitFor();
        expect(
          await dialog(page).getByLabel("Price JSONata rule 1", { exact: true }).innerText(),
        ).toBe("99");
        await page.unroute("**/api/declarations/decision-model/lint");
        await dialog(page).getByRole("button", { name: "Cancel", exact: true }).click();
        await page.getByRole("button", { name: "Discard changes", exact: true }).click();
        await open(page);
        await dialog(page).getByText("Evaluate", { exact: true }).first().click();
        await page.getByLabel("Evaluation input").fill("size: 3");
        await dialog(page).getByRole("button", { name: "Evaluate", exact: true }).click();
        await page.getByText(/price: 10/).waitFor();
        await dialog(page)
          .getByLabel("Price JSONata rule 1", { exact: true })
          .fill('$error("bad price")');
        await dialog(page).getByRole("button", { name: "Evaluate", exact: true }).click();
        await page.getByText(/columnId: price/).waitFor();
        await expect
          .poll(() =>
            dialog(page)
              .getByLabel("Price JSONata rule 1", { exact: true })
              .getAttribute("aria-invalid"),
          )
          .toBe("true");
        await dialog(page).getByRole("button", { name: "Cancel", exact: true }).click();
        await page.getByRole("button", { name: "Discard changes", exact: true }).click();
        await page.getByRole("button", { name: "Discard draft", exact: true }).click();
        await page
          .getByRole("dialog", { name: "Discard draft?" })
          .getByRole("button", { name: "Discard draft", exact: true })
          .click();
        await expect.poll(() => stored(page)).toBeUndefined();
        await open(page);
        expect(
          await dialog(page).getByLabel("Price JSONata rule 1", { exact: true }).innerText(),
        ).toBe("5");
        origins(f);
      } finally {
        await f.close();
      }
    },
    childProcessLimit,
  );
  test(
    `built editor publishes blueprint and model as one commit (${dark ? "dark" : "light"})`,
    async () => {
      const f = await fixture(dark);
      const { page } = f;
      try {
        await edit(page, "8");
        // Publish both files as one commit, with the blueprint retaining its mapped invoke.
        await page.getByRole("button", { name: "YAML", exact: true }).click();
        const blueprintCode = page.locator(".blueprint-code .cm-content");
        await page.getByRole("button", { name: "Copy", exact: true }).click();
        const blueprintText = await page.evaluate(() => navigator.clipboard.readText());
        await blueprintCode.press("ControlOrMeta+a");
        await page.keyboard.insertText(
          blueprintText.replace("context: {}", "context: {label: sample}"),
        );
        await page.getByRole("button", { name: "Publish", exact: true }).click();
        await page
          .getByRole("dialog")
          .getByText("M " + path, { exact: true })
          .waitFor();
        await page
          .getByRole("dialog")
          .getByText("M " + blueprintPath, { exact: true })
          .waitFor();
        await page.getByLabel("Commit message").fill("Adjust sample quote");
        await page.getByRole("button", { name: "Commit and push", exact: true }).click();
        await page
          .locator(".success-text")
          .filter({ hasText: /^Saved as / })
          .waitFor();
        await expect.poll(() => stored(page)).toBeUndefined();
        const source = await (
          await fetch(f.url + "/api/declarations/decision-model?path=" + path)
        ).json();
        expect(parse(source.text).nodes[1].content.config.rules[0].price).toBe("8");
        expect(await git.log({ fs, gitdir: f.f.remote.gitdir, ref: "main" })).toHaveLength(3);
        const bp = f.service.revisions.latest()!.blueprints.get(blueprintPath)!;
        expect(await toPromise(createActor(bp.machine).start())).toMatchObject({
          answer: { price: 10 },
        });
        origins(f);
      } finally {
        await f.close();
      }
    },
    childProcessLimit,
  );
}

for (const dark of [false, true]) {
  test(
    `model conflict preserves the draft and compares/rebases all files (${dark ? "dark" : "light"})`,
    async () => {
      const f = await fixture(dark);
      const { page } = f;
      try {
        await edit(page, "8");
        const laterModel = structuredClone(model);
        laterModel.nodes[1]!.content!.config.rules![0]!.price = "12";
        const later = await f.service.revisions.save({
          base: f.seed,
          files: [{ path, text: stringify(laterModel) }],
          message: "Concurrent sample",
          saveId: "2".repeat(32),
        });
        if (later.outcome === "conflict") throw new Error("Unexpected conflict");
        await page.getByRole("button", { name: "Publish", exact: true }).click();
        await page.getByRole("button", { name: "Commit and push", exact: true }).click();
        await page
          .getByRole("alert")
          .filter({ hasText: path + " changed" })
          .waitFor();
        expect(
          parse((await stored(page)).models[path].text).nodes[1].content.config.rules[0].price,
        ).toBe("8");
        await page.getByRole("button", { name: "Compare", exact: true }).click();
        await expect
          .poll(() => page.getByLabel("Compare file", { exact: true }).inputValue())
          .toBe(path);
        await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
        await page.getByRole("button", { name: "Use latest as base", exact: true }).click();
        await expect.poll(async () => (await stored(page)).base).toBe(later.commit);
        await publish(page);
        await expect.poll(() => stored(page)).toBeUndefined();
        expect(
          parse((await f.service.processRepository.current()!.read(path)!) as string).nodes[1]
            .content.config.rules[0].price,
        ).toBe("8");
        origins(f);
      } finally {
        await f.close();
      }
    },
    childProcessLimit,
  );
  for (const pending of [false, true])
    test(
      `settlement keeps saved text over a later model-only revision after loaded=${!pending} (${dark ? "dark" : "light"})`,
      async () => {
        const f = await fixture(dark);
        const { page } = f;
        let laterCommit = "";
        const move = async (base: string) => {
          const next = structuredClone(model);
          next.nodes[1]!.content!.config.rules![0]!.price = "12";
          const result = await f.service.revisions.save({
            base,
            files: [{ path, text: stringify(next) }],
            message: "Later sample",
            saveId: "3".repeat(32),
          });
          if (result.outcome === "conflict") throw new Error("Later conflict");
          laterCommit = result.commit;
        };
        try {
          await edit(page, "8");
          if (pending)
            f.f.remote.state.beforeReceive = async () => {
              f.f.remote.state.refuseNextFetch = true;
              delete f.f.remote.state.beforeReceive;
            };
          else
            await page.route("**/api/declarations/publish", async (route) => {
              const response = await route.fetch();
              const body = await response.json();
              expect(body.loaded).toBe(true);
              await move(body.commit);
              await route.fulfill({ response });
            });
          await publish(page);
          if (pending) {
            await expect.poll(async () => (await stored(page))?.saved).toBeDefined();
            await page.reload();
            await page.getByRole("button", { name: "Load saved version", exact: true }).waitFor();
            await open(page);
            expect(
              await dialog(page)
                .getByLabel("Price JSONata rule 1", { exact: true })
                .getAttribute("contenteditable"),
            ).toBe("false");
            expect(
              await dialog(page)
                .getByRole("button", { name: "Apply to draft", exact: true })
                .count(),
            ).toBe(0);
            await dialog(page).getByRole("button", { name: "Close", exact: true }).first().click();
            const saved = await stored(page);
            await move(saved.saved);
            await page.getByRole("button", { name: "Load saved version", exact: true }).click();
          }
          await expect.poll(async () => (await stored(page))?.base).toBe(laterCommit);
          const draft = await stored(page);
          expect(draft.saved).toBeUndefined();
          expect(parse(draft.models[path].text).nodes[1].content.config.rules[0].price).toBe("8");
          expect(parse(draft.models[path].baseText).nodes[1].content.config.rules[0].price).toBe(
            "12",
          );
          await page
            .getByText(new RegExp("changed " + path.replaceAll(".", "\\.") + " since"))
            .waitFor();
          await page.reload();
          expect((await stored(page)).base).toBe(laterCommit);
          origins(f);
        } finally {
          await f.close();
        }
      },
      childProcessLimit,
    );
  test(
    `intake and shared models outside the invoke directory lint and publish as drafts (${dark ? "dark" : "light"})`,
    async () => {
      const f = await fixture(dark);
      const { page } = f;
      try {
        await page.getByRole("heading", { name: "Intake", exact: true }).waitFor();
        await page
          .getByRole("button", { name: "Open decision model", exact: true })
          .first()
          .click();
        await dialog(page).getByRole("button", { name: "YAML", exact: true }).click();
        await dialog(page).locator(".blueprint-code .cm-content").fill("[");
        await dialog(page).getByRole("button", { name: "Apply to draft", exact: true }).click();
        await expect
          .poll(() => page.getByRole("button", { name: "Publish", exact: true }).isDisabled())
          .toBe(true);
        await page
          .getByText(/model-syntax/)
          .first()
          .waitFor();
        await page
          .getByRole("button", { name: "Open decision model", exact: true })
          .first()
          .click();
        await dialog(page).locator(".blueprint-code .cm-content").fill(intake);
        await dialog(page).getByRole("button", { name: "Apply to draft", exact: true }).click();
        await page.getByRole("button", { name: "Open decision model", exact: true }).nth(1).click();
        await dialog(page).getByLabel("Price JSONata rule 1", { exact: true }).fill("(");
        await dialog(page).getByRole("button", { name: "Apply to draft", exact: true }).click();
        await expect
          .poll(() => page.getByRole("button", { name: "Publish", exact: true }).isDisabled())
          .toBe(true);
        await page.getByRole("button", { name: "Open decision model", exact: true }).nth(1).click();
        await dialog(page).getByLabel("Price JSONata rule 1", { exact: true }).fill("9");
        await dialog(page).getByRole("button", { name: "Apply to draft", exact: true }).click();
        await publish(page);
        await expect.poll(() => stored(page)).toBeUndefined();
        expect(
          parse(
            (
              await (
                await fetch(f.url + "/api/declarations/decision-model?path=shared/rates.yml")
              ).json()
            ).text,
          ).nodes[1].content.config.rules[0].price,
        ).toBe("9");
        origins(f);
      } finally {
        await f.close();
      }
    },
    childProcessLimit,
  );
}

for (const dark of [false, true])
  test(
    `visual adapters retain unsupported nodes and add JSONata nodes without loading the function editor (${dark ? "dark" : "light"})`,
    async () => {
      const f = await fixture(dark);
      const { page } = f;
      try {
        const unsupported = {
          ...model,
          nodes: [
            ...model.nodes,
            {
              id: "unsupported",
              name: "Unsupported",
              type: "functionNode",
              content: { source: "return 1" },
            },
          ],
        };
        await f.service.revisions.save({
          base: f.seed,
          files: [{ path, text: stringify(unsupported) }],
          message: "External sample editor",
          saveId: "4".repeat(32),
        });
        await page.reload();
        await open(page);
        await dialog(page).getByRole("tab").filter({ hasText: "Graph" }).click();
        await dialog(page).getByRole("button", { name: "Edit Function", exact: true }).click();
        expect(await dialog(page).getByRole("tab").filter({ hasText: "Unsupported" }).count()).toBe(
          0,
        );
        await dialog(page).getByRole("button", { name: "Add node", exact: true }).click();
        expect(
          await dialog(page).getByRole("menuitem", { name: "Input", exact: true }).isDisabled(),
        ).toBe(true);
        await dialog(page)
          .getByRole("menuitem", { name: "JSONata expression", exact: true })
          .click();
        await dialog(page)
          .getByRole("button", { name: "Edit expression", exact: true })
          .last()
          .click();
        await dialog(page)
          .getByRole("textbox", { name: "JSONata expression", exact: true })
          .fill('{"value": 3}');
        await dialog(page).getByRole("tab").filter({ hasText: "Graph" }).click();
        await dialog(page).getByRole("button", { name: "Add node", exact: true }).click();
        await dialog(page).getByRole("menuitem", { name: "JSONata switch", exact: true }).click();
        await dialog(page).getByRole("button", { name: "Add statement", exact: true }).click();
        await dialog(page).getByRole("button", { name: "Remove statement 2", exact: true }).click();
        await dialog(page).getByRole("button", { name: "YAML", exact: true }).click();
        await dialog(page).getByRole("button", { name: "Copy", exact: true }).click();
        const authored = parse(await page.evaluate(() => navigator.clipboard.readText()));
        expect(authored.nodes.find((node: { id: string }) => node.id === "unsupported")).toEqual(
          unsupported.nodes.at(-1),
        );
        expect(
          authored.nodes.some(
            (node: { content?: { kind: string; config: { expression: string } } }) =>
              node.content?.kind === "jsonataExpression" &&
              node.content.config.expression === '{"value": 3}',
          ),
        ).toBe(true);
        expect(
          authored.nodes.some(
            (node: { content?: { kind: string } }) => node.content?.kind === "jsonataSwitch",
          ),
        ).toBe(true);
        origins(f);
      } finally {
        await f.close();
      }
    },
    childProcessLimit,
  );
