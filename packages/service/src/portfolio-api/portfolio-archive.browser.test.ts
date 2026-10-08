// ---
// relationships:
//   verifies: [operator-console, declarations-api, portfolio-api]
// ---
import { chromium } from "playwright";
import { expect, test } from "vite-plus/test";
import { parse } from "yaml";
import { archiveFixture } from "./test-fixtures/archive.ts";
import type { PortfolioResponse } from "@wyrd-company/manifold-shared/portfolio-api";
import git from "isomorphic-git";
import * as fs from "node:fs/promises";
async function openArchive(page: import("playwright").Page, url: string) {
  page.setDefaultTimeout(3000);
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
test("built Portfolio archives two projects in one commit and retries the same save", async () => {
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
    const read = (await fetch(f.url + "/api/portfolio").then((r) => r.json())) as PortfolioResponse;
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
});
test("refused archive applies the concurrent binding commit without any archive choice", async () => {
  const f = await archiveFixture(),
    browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage(),
      dialog = await openArchive(page, f.url);
    const concurrent = await f.concurrentBinding();
    await dialog.getByRole("button", { name: "Archive beta", exact: true }).click();
    await dialog
      .getByRole("alert")
      .filter({ hasText: "portfolio.yml or bindings.yml changed" })
      .waitFor();
    expect(await git.resolveRef({ fs, gitdir: f.fixture.remote.gitdir, ref: "main" })).toBe(
      concurrent,
    );
    const read = (await fetch(f.url + "/api/portfolio").then((r) => r.json())) as PortfolioResponse;
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
});
test("sharing preview changes with the draft while the service balance stays unchanged", async () => {
  const f = await archiveFixture(),
    browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
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
});
test("ended task counts appear on its item and parent", async () => {
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
});
