// ---
// relationships:
//   verifies: [operator-console, declarations-api, portfolio-api]
// ---
import { childProcessLimit } from "../../../../test-support/limits.ts";
import { chromium } from "playwright";
import { expect, test } from "vite-plus/test";
import { parse } from "yaml";
import { formatPercent } from "@wyrd-company/manifold-shared/amounts";
import { archiveFixture } from "./test-fixtures/archive.ts";
import type { PortfolioResponse } from "@wyrd-company/manifold-shared/portfolio-api";
import git from "isomorphic-git";
import * as fs from "node:fs/promises";
async function openArchive(page: import("playwright").Page, url: string) {
  page.setDefaultTimeout(childProcessLimit);
  await page.goto(url + "/console/portfolio");
  await page.getByRole("button", { name: "Expand alpha", exact: true }).click();
  await page.getByRole("button", { name: "Edit beta", exact: true }).click();
  await page.getByRole("button", { name: "Archive item", exact: true }).click();
  const dialog = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("heading", { name: "Archive beta", exact: true }) });
  await dialog.getByText("board-one", { exact: true }).waitFor();
  await dialog.getByText("and 1 associated T3code projects", { exact: true }).waitFor();
  expect(await dialog.getByRole("button", { name: "Archive beta", exact: true }).isDisabled()).toBe(
    true,
  );
  await dialog
    .locator("fieldset")
    .filter({ has: page.getByText("board-one", { exact: true }) })
    .getByLabel("Move to alpha", { exact: true })
    .check();
  await dialog
    .locator("fieldset")
    .filter({ has: page.getByText("board-two", { exact: true }) })
    .getByLabel("Reassign to", { exact: true })
    .check();
  await dialog.getByLabel("Reassign board-two to").selectOption("gamma");
  return dialog;
}
test(
  "built Portfolio archives two projects in one commit and retries the same save",
  async () => {
    const f = await archiveFixture(),
      browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const dialog = await openArchive(page, f.url);
      let request: unknown;
      page.on("request", (r) => {
        if (r.url().endsWith("/archive-item")) request = r.postDataJSON();
      });
      const saving = page.waitForResponse((r) => r.url().endsWith("/archive-item"));
      await dialog.getByRole("button", { name: "Archive beta", exact: true }).click();
      const response = await saving;
      expect({ status: response.status(), body: await response.json() }).toMatchObject({
        status: 200,
        body: { outcome: "saved", loaded: true },
      });
      await page.getByRole("status").filter({ hasText: "Archived beta" }).waitFor();
      const savedRead = (await fetch(f.url + "/api/portfolio").then((r) =>
        r.json(),
      )) as PortfolioResponse;
      expect(savedRead, JSON.stringify(f.logs)).toHaveProperty("items");
      expect(savedRead.items.find((i) => i.id === "beta")?.archived).toBe(true);
      await expect
        .poll(() => page.locator(".portfolio-archived").innerText())
        .toContain("Show archived (1)");
      await page.getByRole("button", { name: "Show archived (1)", exact: true }).click();
      const head = await git.resolveRef({ fs, gitdir: f.fixture.remote.gitdir, ref: "main" });
      const commit = (await git.readCommit({ fs, gitdir: f.fixture.remote.gitdir, oid: head }))
        .commit;
      expect(commit.parent).toEqual([f.base]);
      expect(commit.message).toMatch(/^Archive portfolio item beta\n/);
      const current = f.service.processRepository.current()!;
      const portfolio = await current.read("portfolio.yml"),
        bindings = await current.read("bindings.yml");
      expect(portfolio).toContain("# portfolio comment");
      expect(bindings).toContain("# bindings comment");
      expect(parse(portfolio!).items.alpha.items.beta.archived).toBe(true);
      expect(parse(bindings!).githubProjects).toMatchObject({
        "board-one": { item: "alpha", t3codeProjects: ["workspace-one"] },
        "board-two": { item: "gamma" },
      });
      const read = (await fetch(f.url + "/api/portfolio").then((r) =>
        r.json(),
      )) as PortfolioResponse;
      expect(read.commit).toBe(head);
      expect(
        read.items.find((i) => i.id === "alpha")?.projects.github.map((p) => p.binding),
      ).toContain("board-one");
      expect(
        read.items.find((i) => i.id === "gamma")?.projects.github.map((p) => p.binding),
      ).toContain("board-two");
      const retry = await fetch(f.url + "/api/declarations/archive-item", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      expect(retry.status).toBe(200);
      expect(await retry.json()).toMatchObject({
        outcome: "already-saved",
        commit: head,
        loaded: true,
      });
    } finally {
      await browser.close();
      await f.close();
    }
  },
  childProcessLimit * 2,
);
test(
  "refused archive applies the concurrent binding commit without any archive choice",
  async () => {
    const f = await archiveFixture(),
      browser = await chromium.launch({ headless: true });
    try {
      f.service.store.connection.database.exec(
        "INSERT INTO t3_environment VALUES ('local', 'server', 0, 0)",
      );
      f.service.t3code.recordCreatedProject({
        environment: "local",
        projectId: "p1",
        actorId: "a1",
        item: "beta",
      });
      const page = await browser.newPage(),
        dialog = await openArchive(page, f.url);
      await dialog
        .locator("fieldset")
        .filter({ has: page.getByText("p1", { exact: true }) })
        .getByLabel("Archive project", { exact: true })
        .check();
      const concurrent = await f.concurrentBinding();
      const refusing = page.waitForResponse((r) => r.url().endsWith("/archive-item"));
      await dialog.getByRole("button", { name: "Archive beta", exact: true }).click();
      const refusal = await refusing;
      expect(refusal.status()).toBe(409);
      const conflict = await refusal.json();
      expect(conflict).not.toHaveProperty("text");
      expect(conflict).not.toHaveProperty("files");
      await dialog
        .getByRole("alert")
        .filter({ hasText: "portfolio.yml or bindings.yml changed" })
        .waitFor();
      expect(await git.resolveRef({ fs, gitdir: f.fixture.remote.gitdir, ref: "main" })).toBe(
        concurrent,
      );
      expect(
        (await fetch(f.url + "/api/declarations/bindings").then((r) => r.json())).createdProjects,
      ).toContainEqual({ environment: "local", project: "p1", actorId: "a1", item: "beta" });
      expect(f.service.portfolio.t3codeProject({ environment: "local", id: "p1" })).toMatchObject({
        via: "created",
        item: "beta",
      });
      const read = (await fetch(f.url + "/api/portfolio").then((r) =>
        r.json(),
      )) as PortfolioResponse;
      expect(read.commit).toBe(concurrent);
      expect(read.items.find((i) => i.id === "beta")).toMatchObject({
        archived: false,
        projects: { github: [{ binding: "board-one" }, { binding: "board-two" }] },
      });
      expect(read.items.find((i) => i.id === "gamma")?.projects.t3code).toContainEqual(
        expect.objectContaining({ binding: "board-three" }),
      );
      await dialog.getByRole("button", { name: "Read again", exact: true }).click();
      expect(await dialog.getByLabel("Reassign board-two to").inputValue()).toBe("gamma");
      await expect
        .poll(() => dialog.getByRole("button", { name: "Archive beta", exact: true }).isEnabled())
        .toBe(true);
    } finally {
      await browser.close();
      await f.close();
    }
  },
  childProcessLimit * 2,
);
test(
  "sharing preview changes with the draft while the service balance stays unchanged",
  async () => {
    const f = await archiveFixture(),
      browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(childProcessLimit);
      await page.goto(f.url + "/console/portfolio");
      const before = (await fetch(f.url + "/api/portfolio").then((r) =>
        r.json(),
      )) as PortfolioResponse;
      await page.getByRole("button", { name: "Edit allocations", exact: true }).click();
      const delta = page.getByRole("row").filter({ has: page.getByText("delta", { exact: true }) });
      await delta.getByText("Alone 60%", { exact: true }).waitFor();
      await delta.getByText("All waiting 40%", { exact: true }).waitFor();
      await page.getByLabel("delta allocation", { exact: true }).fill("50");
      await delta.getByText("All waiting 53.33%", { exact: true }).waitFor();
      const after = (await fetch(f.url + "/api/portfolio").then((r) =>
        r.json(),
      )) as PortfolioResponse;
      expect(after.items.find((i) => i.id === "delta")?.allocations).toEqual(
        before.items.find((i) => i.id === "delta")?.allocations,
      );
      expect(after.commit).toBe(before.commit);
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.getByRole("button", { name: "Discard changes", exact: true }).click();
    } finally {
      await browser.close();
      await f.close();
    }
  },
  childProcessLimit * 2,
);
test(
  "ended task counts appear on its item and parent",
  async () => {
    const f = await archiveFixture(),
      browser = await chromium.launch({ headless: true });
    try {
      const source = "blueprints/completed.yml";
      const saved = await f.service.revisions.save({
        base: f.base,
        files: [
          {
            path: source,
            text: "machine:\n  initial: working\n  context: {}\n  states:\n    working:\n      on: { FINISH: done }\n    done: { type: final }\nschemas:\n  input: true\n  context: true\n  output: true\n  events: { FINISH: true }\n",
          },
        ],
        message: "Declare sample process",
        saveId: "3".repeat(32),
      });
      if (saved.outcome === "conflict") throw Error("Expected process");
      expect(saved.blueprints!.failures.get(source)).toBeUndefined();
      const blueprint = saved.blueprints!.blueprints.get(source)!;
      f.service.actorHost.start({
        actorId: "task:sample",
        blueprint,
        input: { manifold: { portfolioItem: "gamma", issue: "sample" } },
      });
      const page = await browser.newPage();
      page.setDefaultTimeout(childProcessLimit);
      await page.goto(f.url + "/console/portfolio");
      await page.getByRole("button", { name: "Expand alpha", exact: true }).click();
      const gamma = page.getByRole("row").filter({ has: page.getByText("gamma", { exact: true }) });
      await gamma.getByRole("cell").nth(4).filter({ hasText: "1" }).waitFor();
      const outcome = f.service.router.publish({
        source: "github",
        eventId: "finished",
        topics: ["github.issue.sample"],
        event: { type: "FINISH" },
      });
      expect(outcome.status).toBe("accepted");
      await expect.poll(() => f.service.store.endedSnapshots().length).toBe(1);
      await page.reload();
      await gamma.getByRole("cell").nth(5).filter({ hasText: "1" }).waitFor();
      expect(await gamma.getByRole("cell").nth(4).innerText()).toBe("—");
      const alpha = page.getByRole("row").filter({ has: page.getByText("alpha", { exact: true }) });
      expect(await alpha.getByRole("cell").nth(5).innerText()).toBe("1");
    } finally {
      await browser.close();
      await f.close();
    }
  },
  childProcessLimit * 2,
);

test(
  "item dialog previews candidate allocations and guards unsaved archive actions",
  async () => {
    const f = await archiveFixture(),
      browser = await chromium.launch({ headless: true });
    try {
      const portfolio = await f.service.processRepository.current()!.read("portfolio.yml");
      await f.service.revisions.save({
        base: f.base,
        saveId: "3".repeat(32),
        message: "Name sample parent",
        files: [
          {
            path: "portfolio.yml",
            text: portfolio!.replace("  alpha:\n", "  alpha:\n    title: Sample parent\n"),
          },
        ],
      });
      const page = await browser.newPage();
      page.setDefaultTimeout(childProcessLimit);
      await page.goto(f.url + "/console/portfolio");
      await page.getByRole("button", { name: "Expand Sample parent", exact: true }).click();
      await page.getByRole("button", { name: "Edit beta", exact: true }).click();
      let dialog = page
        .getByRole("dialog")
        .filter({ has: page.getByRole("heading", { name: "Edit item", exact: true }) });
      await dialog.getByText("Its allocation returns to Sample parent.", { exact: true }).waitFor();
      await dialog.getByText(/Can reserve, halfway through an idle window:/).waitFor();
      const linting = page.waitForResponse((r) => r.url().endsWith("/lint"));
      await dialog.getByLabel("beta allocation", { exact: true }).fill("50");
      const lint = await (await linting).json();
      const preview = lint.preview
        .find((a: { account: string }) => a.account === "acct-a")
        .items.find((i: { item: string }) => i.item === "beta");
      await dialog
        .getByText(
          `Can reserve, halfway through an idle window: ${formatPercent(preview.alone)} alone, ${formatPercent(preview.allWaiting)} with every item waiting.`,
          { exact: true },
        )
        .waitFor();
      expect(
        await dialog.getByRole("button", { name: "Archive item", exact: true }).isDisabled(),
      ).toBe(true);
      await dialog.getByText("Save or discard your changes first.", { exact: true }).waitFor();
      await dialog.getByLabel("beta allocation", { exact: true }).fill("101");
      await expect.poll(() => dialog.locator(".portfolio-dialog-sharing").innerText()).toBe("—");
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.getByRole("button", { name: "Edit Sample parent", exact: true }).click();
      dialog = page
        .getByRole("dialog")
        .filter({ has: page.getByRole("heading", { name: "Edit item", exact: true }) });
      await dialog.getByText("Its allocation returns to the top level.", { exact: true }).waitFor();
      const child = dialog
        .locator(".portfolio-sub-item")
        .filter({ has: page.getByLabel("beta allocation", { exact: true }) });
      expect(await child.getByRole("button", { name: "Remove", exact: true }).isEnabled()).toBe(
        true,
      );
      await dialog.getByLabel("Name", { exact: true }).first().fill("Changed parent");
      expect(await child.getByRole("button", { name: "Remove", exact: true }).isDisabled()).toBe(
        true,
      );
      expect(
        await dialog.getByRole("button", { name: "Archive item", exact: true }).isDisabled(),
      ).toBe(true);
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.getByRole("button", { name: "Edit beta", exact: true }).click();
      expect(
        await page.getByRole("button", { name: "Archive item", exact: true }).isEnabled(),
      ).toBe(true);
    } finally {
      await browser.close();
      await f.close();
    }
  },
  childProcessLimit * 2,
);

test(
  "built archive lists created projects, saves all choices and resolves an archived item",
  async () => {
    const f = await archiveFixture(),
      browser = await chromium.launch({ headless: true });
    try {
      const db = f.service.store.connection.database;
      db.exec("INSERT INTO t3_environment VALUES ('local', 'server', 0, 0)");
      for (const projectId of ["p1", "p2", "p3"])
        f.service.t3code.recordCreatedProject({
          environment: "local",
          projectId,
          actorId: "a1",
          item: "beta",
        });
      f.service.t3code.recordCreatedProject({
        environment: "local",
        projectId: "p4",
        actorId: "a1",
        item: "gamma",
      });
      f.service.t3code.recordCreatedProject({
        environment: "local",
        projectId: "p5",
        actorId: "a1",
        item: "beta",
      });
      await f.service.revisions.save({
        base: f.base,
        saveId: "e".repeat(32),
        message: "Bind sample project",
        files: [
          {
            path: "bindings.yml",
            text:
              (await f.service.processRepository.current()!.read("bindings.yml")) +
              "t3codeProjects:\n  bound-five: {environment: local, project: p5, item: beta}\n",
          },
        ],
      });
      const page = await browser.newPage(),
        dialog = await openArchive(page, f.url);
      expect(await dialog.getByText("local · p4", { exact: true }).count()).toBe(0);
      expect(await dialog.getByText("p5", { exact: true }).count()).toBe(0);
      expect(await dialog.getByText("Created by a task", { exact: false }).count()).toBe(3);
      await dialog
        .locator("fieldset")
        .filter({ has: page.getByText("bound-five", { exact: true }) })
        .getByLabel("Move to alpha", { exact: true })
        .check();
      for (const [project, choice] of [
        ["p1", "Move to alpha"],
        ["p2", "Reassign to"],
        ["p3", "Archive project"],
      ]) {
        const row = dialog
          .locator("fieldset")
          .filter({ has: page.getByText(project!, { exact: true }) });
        await row.getByLabel(choice!, { exact: true }).check();
      }
      await dialog.getByLabel("Reassign t3-p2 to").selectOption("gamma");
      f.service.t3code.recordCreatedProject({
        environment: "local",
        projectId: "p6",
        actorId: "a1",
        item: "beta",
      });
      const rejected = page.waitForResponse((r) => r.url().endsWith("/archive-item"));
      await dialog.getByRole("button", { name: "Archive beta", exact: true }).click();
      expect((await rejected).status()).toBe(422);
      await dialog.getByText("local · p6", { exact: true }).waitFor();
      expect(
        await dialog.getByRole("button", { name: "Archive beta", exact: true }).isDisabled(),
      ).toBe(true);
      await dialog
        .locator("fieldset")
        .filter({ has: page.getByText("p6", { exact: true }) })
        .getByLabel("Archive project", { exact: true })
        .check();
      const saving = page.waitForResponse((r) => r.url().endsWith("/archive-item"));
      await dialog.getByRole("button", { name: "Archive beta", exact: true }).click();
      const savedResponse = await saving;
      expect(savedResponse.status()).toBe(200);
      await page.getByRole("status").filter({ hasText: "Archived beta" }).waitFor();
      expect(f.service.portfolio.createdProjects().find((p) => p.project === "p1")).toMatchObject({
        createdItem: "beta",
        usageItem: "alpha/other",
      });
      f.service.t3code.recordCreatedProject({
        environment: "local",
        projectId: "p7",
        actorId: "a1",
        item: "beta",
      });
      const retry = await fetch(f.url + "/api/declarations/archive-item", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: savedResponse.request().postData(),
      });
      expect(retry.status).toBe(200);
      expect(await retry.json()).toMatchObject({
        outcome: "already-saved",
        commit: (await savedResponse.json()).commit,
      });
      await page.reload();
      await page.getByRole("button", { name: "Show archived (1)", exact: true }).click();
      const warning = page.getByText("1 projects to resolve", { exact: true });
      await warning.waitFor();
      expect(await warning.getAttribute("class")).toBe("warning-text");
      await page.getByRole("button", { name: "Choose project moves", exact: true }).click();
      const resolve = page
        .getByRole("dialog")
        .filter({ has: page.getByRole("heading", { name: "Projects of beta", exact: true }) });
      await resolve.getByLabel("Archive project", { exact: true }).check();
      await resolve.getByRole("button", { name: "Save choices", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "Saved project choices" }).waitFor();
      expect(
        f.service.portfolio.createdProjects().find((p) => p.project === "p7")?.unresolved,
      ).toBe(false);
    } finally {
      await browser.close();
      await f.close();
    }
  },
  childProcessLimit * 2,
);

test(
  "built archive preserves a created project's Other through an archived parent binding",
  async () => {
    const f = await archiveFixture(),
      browser = await chromium.launch({ headless: true });
    try {
      const current = f.service.processRepository.current()!;
      await f.service.revisions.save({
        base: current.commit,
        saveId: "f".repeat(32),
        message: "Declare sample sub-item",
        files: [
          {
            path: "portfolio.yml",
            text: (await current.read("portfolio.yml"))!.replace(
              "      beta:\n",
              "      beta:\n        items:\n          child: {}\n",
            ),
          },
        ],
      });
      f.service.store.connection.database.exec(
        "INSERT INTO t3_environment VALUES ('local', 'server', 0, 0)",
      );
      f.service.t3code.recordCreatedProject({
        environment: "local",
        projectId: "p8",
        actorId: "a1",
        item: "beta/other",
      });
      const page = await browser.newPage(),
        dialog = await openArchive(page, f.url);
      await dialog.getByText("local · p8", { exact: true }).waitFor();
      for (const radio of await dialog.getByLabel("Archive project", { exact: true }).all())
        await radio.check();
      await dialog.getByRole("button", { name: "Archive beta", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "Archived beta" }).waitFor();
      expect(
        f.service.portfolio.current().declaration.t3codeProjects.find((p) => p.project === "p8"),
      ).toMatchObject({ item: "beta", archived: true });
      expect(f.service.portfolio.createdProjects().find((p) => p.project === "p8")).toMatchObject({
        createdItem: "beta/other",
        usageItem: "beta/other",
        unresolved: false,
      });
    } finally {
      await browser.close();
      await f.close();
    }
  },
  childProcessLimit * 2,
);
