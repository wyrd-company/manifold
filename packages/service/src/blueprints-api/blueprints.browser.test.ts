// ---
// relationships:
//   verifies: [operator-console, blueprints-api]
// ---
import { chromium } from "playwright";
import * as fs from "node:fs/promises";
import git from "isomorphic-git";
import { stringify } from "yaml";
import { expect, test } from "vite-plus/test";
import { serviceFixture } from "../service/test-fixtures/repository.ts";
import { mountBlueprintsApi } from "./index.ts";
import { mountConsole } from "../console/index.ts";
import { consoleHost } from "../console/test-fixtures/host.ts";
import { startService } from "../service/index.ts";
test("built Blueprints editor lints, preserves drafts, publishes once, and reloads its YAML route", async () => {
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
  const browser = await chromium.launch({ headless: true });
  try {
    const address = service.http.address();
    const url = `http://${address.host}:${address.port}`;
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url + "/console/blueprints");
    await page.getByRole("link", { name: "blueprints/counter.yml", exact: true }).click();
    await page.getByRole("button", { name: "YAML", exact: true }).click();
    await page.locator(".blueprint-source .cm-content").waitFor();
    expect(await page.locator(".breadcrumb").innerText()).toContain("blueprints/counter.yml");
    await page.getByRole("button", { name: "Canvas", exact: true }).click();
    await page.locator(".canvas-state").getByText("counting", { exact: true }).waitFor();
    await page.getByRole("button", { name: "YAML", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: "YAML", exact: true }).click();
    await page.locator(".blueprint-source .cm-content").waitFor();
    const original = await page.locator(".blueprint-source .cm-content").innerText();
    await page
      .locator(".blueprint-source .cm-content")
      .fill(original.replace("counting: {}", "counting:\n      on:\n        GO: missing"));
    await page.waitForFunction(
      () => document.querySelector(".error-text")?.textContent !== "0 errors",
    );
    expect(await page.getByRole("button", { name: "Publish", exact: true }).isDisabled()).toBe(
      true,
    );
    await page.getByRole("button", { name: "Canvas", exact: true }).click();
    await page.locator(".blueprint-problem.error").first().waitFor();
    expect(await page.locator(".blueprint-problem.error").count()).toBeGreaterThan(0);
    await page.getByRole("button", { name: "YAML", exact: true }).click();
    await page
      .locator(".blueprint-source .cm-content")
      .fill(original.replace("count: 60", "count: 61"));
    await page.waitForFunction(
      () =>
        !document.querySelector<HTMLButtonElement>(".blueprint-header-actions button:last-child")
          ?.disabled,
    );
    await page.reload();
    await page.getByRole("button", { name: "YAML", exact: true }).click();
    await page.locator(".blueprint-source .cm-content").waitFor();
    expect(await page.locator(".blueprint-source .cm-content").innerText()).toContain("count: 61");
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByLabel("Commit message").fill("Adjust sample count");
    await page.getByRole("button", { name: "Commit and push", exact: true }).click();
    await page
      .getByRole("status")
      .filter({ hasText: /^Saved as [0-9a-f]{7}$/ })
      .waitFor();
    const commits = await git.log({ fs, gitdir: f.remote.gitdir, ref: "main" });
    expect(commits).toHaveLength(2);
    expect(commits[0]?.commit.message).toContain("Adjust sample count");
    await page.reload();
    await page.getByRole("button", { name: "YAML", exact: true }).click();
    await page.locator(".blueprint-source .cm-content").waitFor();
    expect(await page.locator(".blueprint-source .cm-content").innerText()).toContain("count: 61");
    expect(await page.getByRole("button", { name: "Publish", exact: true }).isDisabled()).toBe(
      true,
    );
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await service.stop();
    await f.close();
  }
}, 30_000);

test.each([false, true])(
  "pending saves keep text through reload and settle under a later commit=%s",
  async (later) => {
    const f = await serviceFixture();
    await git.setConfig({ fs, gitdir: f.remote.gitdir, path: "http.receivepack", value: true });
    let refuse = true;
    const service = await startService({
      configurationFile: f.file,
      log: () => {},
      probes: {
        save: (step) => {
          if (step === "pushed" && refuse) {
            f.remote.state.refuseNextFetch = true;
            refuse = false;
          }
        },
      },
    });
    const browser = await chromium.launch({ headless: true });
    try {
      const address = service.http.address();
      const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
      await page.goto(
        `http://${address.host}:${address.port}/console/blueprints/blueprints/counter.yml`,
      );
      await page.getByRole("button", { name: "YAML", exact: true }).click();
      await page.locator(".blueprint-source .cm-content").waitFor();
      const original = await page.locator(".blueprint-source .cm-content").innerText();
      await page
        .locator(".blueprint-source .cm-content")
        .fill(original.replace("count: 60", "count: 61"));
      await page.waitForFunction(
        () =>
          !document.querySelector<HTMLButtonElement>(".blueprint-header-actions button:last-child")
            ?.disabled,
      );
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      await page.getByRole("button", { name: "Commit and push", exact: true }).click();
      await page.getByRole("button", { name: "Load saved version" }).waitFor();
      await page.reload();
      await page.getByRole("button", { name: "Load saved version" }).waitFor();
      await page.getByRole("button", { name: "YAML", exact: true }).click();
      expect(
        await page.locator(".blueprint-source .cm-content").getAttribute("contenteditable"),
      ).toBe("false");
      expect(await page.locator(".blueprint-source .cm-content").innerText()).toContain(
        "count: 61",
      );
      if (later) {
        const parent = await git.resolveRef({ fs, gitdir: f.remote.gitdir, ref: "main" });
        const old = await git.readCommit({ fs, gitdir: f.remote.gitdir, oid: parent });
        const root = await git.readTree({ fs, gitdir: f.remote.gitdir, oid: old.commit.tree });
        const blueprint = root.tree.find((entry) => entry.path === "blueprints")!;
        const subtree = await git.readTree({ fs, gitdir: f.remote.gitdir, oid: blueprint.oid });
        const blob = await git.writeBlob({
          fs,
          gitdir: f.remote.gitdir,
          blob: Buffer.from(original.replace("count: 60", "count: 62")),
        });
        const tree = await git.writeTree({
          fs,
          gitdir: f.remote.gitdir,
          tree: subtree.tree.map((entry) =>
            entry.path === "counter.yml" ? { ...entry, oid: blob } : entry,
          ),
        });
        const newroot = await git.writeTree({
          fs,
          gitdir: f.remote.gitdir,
          tree: root.tree.map((entry) =>
            entry.path === "blueprints" ? { ...entry, oid: tree } : entry,
          ),
        });
        const commit = await git.writeCommit({
          fs,
          gitdir: f.remote.gitdir,
          commit: {
            ...old.commit,
            tree: newroot,
            parent: [parent],
            message: "Later sample change",
          },
        });
        await f.remote.force(commit);
      }
      await page.getByRole("button", { name: "Load saved version" }).click();
      await page.getByRole("button", { name: "Publish", exact: true }).waitFor();
      expect(await page.getByRole("button", { name: "Load saved version" }).count()).toBe(0);
      if (later) {
        await page.getByText(/changed this file since/).waitFor();
        expect(await page.locator(".blueprint-source .cm-content").innerText()).toContain(
          "count: 61",
        );
        await page.getByRole("button", { name: "Compare", exact: true }).click();
        await page.getByRole("dialog").waitFor();
        expect(await page.locator(".cm-merge-a .cm-content").innerText()).toContain("count: 62");
        expect(
          await page.getByRole("dialog").locator(".cm-merge-b .cm-content").innerText(),
        ).toContain("count: 61");
        await page.getByRole("button", { name: "Close", exact: true }).click();
        await page.getByRole("button", { name: "Discard draft", exact: true }).click();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Discard draft", exact: true })
          .click();
        await page.waitForFunction(() =>
          document
            .querySelector(".blueprint-source .cm-content")
            ?.textContent?.includes("count: 62"),
        );
      } else
        expect(await page.getByRole("button", { name: "Publish", exact: true }).isDisabled()).toBe(
          true,
        );
      expect(await git.log({ fs, gitdir: f.remote.gitdir, ref: "main" })).toHaveLength(
        later ? 3 : 2,
      );
      expect(
        await page.evaluate(() =>
          localStorage.getItem("manifold.blueprint-draft.blueprints/counter.yml"),
        ),
      ).toBeNull();
    } finally {
      await browser.close();
      await service.stop();
      await f.close();
    }
  },
  30_000,
);

test("conflicting drafts survive reload and the operator can compare and replace the base", async () => {
  const f = await serviceFixture();
  await git.setConfig({ fs, gitdir: f.remote.gitdir, path: "http.receivepack", value: true });
  const service = await startService({ configurationFile: f.file, log: () => {} });
  const browser = await chromium.launch({ headless: true });
  try {
    const address = service.http.address();
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(
      `http://${address.host}:${address.port}/console/blueprints/blueprints/counter.yml`,
    );
    await page.getByRole("button", { name: "YAML", exact: true }).click();
    await page.locator(".blueprint-source .cm-content").waitFor();
    const original = await page.locator(".blueprint-source .cm-content").innerText();
    await page
      .locator(".blueprint-source .cm-content")
      .fill(original.replace("count: 60", "count: 61"));
    await f.commit(62);
    await page.waitForFunction(
      () =>
        !document.querySelector<HTMLButtonElement>(".blueprint-header-actions button:last-child")
          ?.disabled,
    );
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("button", { name: "Commit and push", exact: true }).click();
    await page.getByRole("button", { name: "Use latest as base" }).waitFor();
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    await page.locator(".cm-merge-a .cm-content").waitFor();
    expect(await page.locator(".cm-merge-a .cm-content").innerText()).toContain("count: 62");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: "YAML", exact: true }).click();
    await page.locator(".blueprint-source .cm-content").waitFor();
    expect(await page.locator(".blueprint-source .cm-content").innerText()).toContain("count: 61");
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("button", { name: "Commit and push", exact: true }).click();
    await page.getByRole("button", { name: "Use latest as base" }).click();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("button", { name: "Commit and push", exact: true }).click();
    await page
      .getByRole("status")
      .filter({ hasText: /^Saved as [0-9a-f]{7}$/ })
      .waitFor();
    expect(await git.log({ fs, gitdir: f.remote.gitdir, ref: "main" })).toHaveLength(3);
  } finally {
    await browser.close();
    await service.stop();
    await f.close();
  }
}, 30_000);

test("bundled blueprints list and publish as repository replacements", async () => {
  const f = await serviceFixture();
  await git.setConfig({ fs, gitdir: f.remote.gitdir, path: "http.receivepack", value: true });
  const service = await startService({ configurationFile: f.file, log: () => {} });
  const host = await consoleHost();
  mountConsole(host.host, { store: service.store });
  const source = await service.processRepository.revisionAt(f.first);
  const text = (await source!.read("blueprints/counter.yml"))!;
  mountBlueprintsApi(host.host, {
    revisions: service.revisions,
    processRepository: service.processRepository,
    store: service.store,
    repository: { url: f.remote.url, branch: "main" },
    configurationBound: 1000,
    bundle: {
      digest: "d".repeat(64),
      blueprints: new Map([
        ["blueprints/sample.yml", text],
        ["blueprints/counter.yml", text],
      ]),
    },
    log: () => {},
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(host.url + "/console/blueprints");
    await page.getByRole("cell", { name: /Bundled/ }).waitFor();
    await page.getByText("Replaces the bundled blueprint").waitFor();
    await page.getByRole("link", { name: "blueprints/sample.yml", exact: true }).click();
    await page.getByRole("button", { name: "YAML", exact: true }).click();
    await page.locator(".blueprint-source .cm-content").waitFor();
    const original = await page.locator(".blueprint-source .cm-content").innerText();
    await page
      .locator(".blueprint-source .cm-content")
      .fill(original.replace("count: 60", "count: 61"));
    await page.waitForFunction(
      () =>
        !document.querySelector<HTMLButtonElement>(".blueprint-header-actions button:last-child")
          ?.disabled,
    );
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByText("This file replaces the bundled blueprint.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Commit and push", exact: true }).click();
    await page
      .getByRole("status")
      .filter({ hasText: /^Saved as [0-9a-f]{7}$/ })
      .waitFor();
    expect(await git.log({ fs, gitdir: f.remote.gitdir, ref: "main" })).toHaveLength(2);
  } finally {
    await browser.close();
    await host.close();
    await service.stop();
    await f.close();
  }
}, 30_000);

test("late lint answers cannot mark newer text", async () => {
  const f = await serviceFixture();
  const service = await startService({ configurationFile: f.file, log: () => {} });
  const browser = await chromium.launch({ headless: true });
  try {
    const address = service.http.address();
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.addInitScript(() => {
      const original = window.fetch;
      window.fetch = (input, init) =>
        original(
          input,
          typeof input === "string" && input.endsWith("/lint") ? { ...init, signal: null } : init,
        );
    });
    let first = true;
    let release!: () => void;
    let received!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const seen = new Promise<void>((resolve) => {
      received = resolve;
    });
    await page.route("**/api/blueprints/lint", async (route) => {
      if (first) {
        first = false;
        received();
        await held;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            findings: [
              {
                kind: "target",
                location: "/machine/states/counting",
                message: "Old diagnostic",
                range: { from: 0, to: 1, line: 1, column: 1 },
              },
            ],
            warnings: [],
          }),
        });
      } else await route.continue();
    });
    await page.goto(
      `http://${address.host}:${address.port}/console/blueprints/blueprints/counter.yml`,
    );
    await page.getByRole("button", { name: "YAML", exact: true }).click();
    await page.locator(".blueprint-source .cm-content").waitFor();
    const original = await page.locator(".blueprint-source .cm-content").innerText();
    await page
      .locator(".blueprint-source .cm-content")
      .fill(original.replace("count: 60", "count: 61"));
    await seen;
    await page
      .locator(".blueprint-source .cm-content")
      .fill(original.replace("count: 60", "count: 62"));
    await page.waitForFunction(
      () =>
        !document.querySelector<HTMLButtonElement>(".blueprint-header-actions button:last-child")
          ?.disabled,
    );
    release();
    await page.waitForResponse(
      (response) => response.url().endsWith("/lint") && response.status() === 200,
    );
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    expect(await page.getByText("Old diagnostic").count()).toBe(0);
    expect(await page.getByRole("button", { name: "Publish", exact: true }).isDisabled()).toBe(
      false,
    );
  } finally {
    await browser.close();
    await service.stop();
    await f.close();
  }
}, 30_000);

test.each(["aborted", "failed", "successful retry"] as const)(
  "lint recovery keeps Publish ready after %s",
  async (outcome) => {
    const fixture = await serviceFixture();
    const service = await startService({ configurationFile: fixture.file, log: () => {} });
    const browser = await chromium.launch({ headless: true });
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      const address = service.http.address();
      const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
      await page.goto(
        `http://${address.host}:${address.port}/console/blueprints/blueprints/counter.yml`,
      );
      await page.getByRole("button", { name: "YAML", exact: true }).click();
      await page.locator(".blueprint-source .cm-content").waitFor();
      const original = await page.locator(".blueprint-source .cm-content").innerText();
      const checked = original.replace("count: 60", "count: 61");
      await page.locator(".blueprint-source .cm-content").fill(checked);
      await page.waitForFunction(
        () =>
          !document.querySelector<HTMLButtonElement>(".blueprint-header-actions button:last-child")
            ?.disabled,
      );
      let received!: () => void;
      const seen = new Promise<void>((resolve) => {
        received = resolve;
      });
      let requests = 0;
      await page.route("**/api/blueprints/lint", async (route) => {
        requests++;
        received();
        if (outcome === "successful retry" && requests === 2) {
          await route.continue();
          return;
        }
        if (outcome === "aborted") await held;
        await route.fulfill({
          status: 502,
          contentType: "application/json",
          body: JSON.stringify({ error: "remote", message: "Example lint failure" }),
        });
      });
      await page
        .locator(".blueprint-source .cm-content")
        .fill(original.replace("count: 60", "count: 62"));
      await seen;
      if (outcome !== "aborted")
        await page.getByText("Cannot check this text.", { exact: false }).waitFor();
      else await page.getByText("Checking…", { exact: true }).waitFor();
      if (outcome !== "aborted") {
        const retried = page.waitForResponse("**/api/blueprints/lint");
        await page.getByRole("button", { name: "Try again", exact: true }).click();
        await retried;
        if (outcome === "failed")
          await page.getByText("Cannot check this text.", { exact: false }).waitFor();
      }
      if (outcome !== "successful retry")
        await page.locator(".blueprint-source .cm-content").fill(checked);
      await page.waitForFunction(
        () =>
          !document.querySelector<HTMLButtonElement>(".blueprint-header-actions button:last-child")
            ?.disabled,
        undefined,
        { timeout: 2000 },
      );
      expect(await page.getByText("Checking…", { exact: true }).count()).toBe(0);
      expect(await page.getByText("Cannot check this text.", { exact: false }).count()).toBe(0);
      // Wait past the lint debounce to prove recovery sends no redundant request.
      await page.waitForTimeout(500);
      expect(await page.getByRole("button", { name: "Publish", exact: true }).isDisabled()).toBe(
        false,
      );
      expect(requests).toBe(outcome === "aborted" ? 1 : 2);
    } finally {
      release();
      await browser.close();
      await service.stop();
      await fixture.close();
    }
  },
  30_000,
);
