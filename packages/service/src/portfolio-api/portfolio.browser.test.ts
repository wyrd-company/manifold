// ---
// relationships:
//   verifies: [operator-console, portfolio-api]
// ---
import { chromium } from "playwright";
import { expect, test } from "vite-plus/test";
import * as fs from "node:fs/promises";
import git from "isomorphic-git";
import { stringify } from "yaml";
import { serviceFixture } from "../service/test-fixtures/repository.ts";
import { startService } from "../service/index.ts";
test("built Portfolio reads settled balances, lints allocations, saves one commit and reloads", async () => {
  const f = await serviceFixture();
  const reset = new Date(Date.now() - 86400000).toISOString();
  await f.commit(50, {
    accounts: {
      accounts: {
        "acct-a": { unit: "usd", kind: "api", capacity: { amount: 10, reset, every: { days: 1 } } },
        "acct-b": {
          unit: "usd",
          kind: "subscription",
          capacity: { amount: 20, reset, every: { days: 7 } },
        },
      },
    },
  });
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
    const revision = service.processRepository.current()!;
    const text =
      "# allocation comment\nitems:\n  alpha:\n    allocations:\n      acct-a: { guarantee: 50 }\n      acct-b: { guarantee: 50 }\n  beta:\n    allocations:\n      acct-a: { guarantee: 50 }\n      acct-b: { guarantee: 50 }\n";
    const seeded = await service.revisions.save({
      base: revision.commit,
      message: "Declare sample budgets",
      saveId: "1".repeat(32),
      files: [{ path: "portfolio.yml", text: text }],
    });
    expect(seeded.outcome).toBe("saved");
    for (const [account, item, amount] of [
      ["acct-a", "alpha", 17700],
      ["acct-b", "beta", 500000],
    ] as const) {
      const actor = "task:" + item;
      service.portfolio.ledger.reserve({
        key: "reserve-" + account,
        actor,
        item,
        account,
        amount: 1000000,
      });
      service.portfolio.ledger.postActual({
        key: "actual-" + account,
        actor,
        item,
        account,
        amount,
        usedAt: Date.now(),
      });
      service.portfolio.ledger.settle({ actor });
    }
    const address = service.http.address(),
      url = `http://${address.host}:${address.port}`,
      page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }),
      errors: string[] = [];
    page.setDefaultTimeout(3000);
    page.on("pageerror", (e) => errors.push(e.message));
    for (const [headers, expected] of [
      [{ "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" }, 403],
      [{ "Content-Type": "text/plain" }, 415],
    ] as const) {
      const refused = await fetch(url + "/api/declarations/lint", {
        method: "POST",
        headers,
        body: JSON.stringify({ path: "portfolio.yml", text }),
      });
      expect(refused.status).toBe(expected);
    }
    const invalidSave = await fetch(url + "/api/declarations/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "portfolio.yml",
        text: text.replaceAll("guarantee: 50", "guarantee: 70"),
        base: service.processRepository.current()!.commit,
        message: "Invalid sample budget",
        saveId: "f".repeat(32),
      }),
    });
    expect(invalidSave.status).toBe(422);
    await page.goto(url + "/console/portfolio");
    const titleBox = await page
      .getByRole("heading", { name: "Portfolio", exact: true })
      .boundingBox();
    const actionsBox = await page
      .getByRole("button", { name: "Edit allocations", exact: true })
      .boundingBox();
    expect(Math.abs(titleBox!.y - actionsBox!.y)).toBeLessThan(50);
    await page
      .locator(".portfolio-budget-card")
      .filter({ hasText: "acct-a" })
      .getByText("$0.0177", { exact: true })
      .waitFor();
    await page
      .locator(".portfolio-budget-card")
      .filter({ hasText: "acct-b" })
      .getByText("$0.50", { exact: true })
      .waitFor();
    const alpha = page.getByRole("row").filter({ has: page.getByText("alpha", { exact: true }) });
    await alpha.getByText("$5.00", { exact: true }).waitFor();
    await alpha.getByText("$4.98", { exact: true }).waitFor();
    await page.getByLabel("Allocations for").selectOption("acct-b");
    const beta = page.getByRole("row").filter({ has: page.getByText("beta", { exact: true }) });
    await beta.getByText("$10.00", { exact: true }).waitFor();
    expect(new URL(page.url()).searchParams.get("account")).toBe("acct-b");
    await page.reload();
    expect(await page.getByLabel("Allocations for").inputValue()).toBe("acct-b");
    await page.getByLabel("Allocations for").selectOption("acct-a");
    await page.getByRole("button", { name: "Edit allocations", exact: true }).click();
    await page.getByLabel("alpha allocation", { exact: true }).fill("70");
    await page.getByLabel("beta allocation", { exact: true }).fill("40");
    await page
      .locator(".portfolio-problems")
      .getByText(/total 110%/)
      .waitFor();
    expect(
      await page.getByLabel("alpha allocation", { exact: true }).getAttribute("aria-invalid"),
    ).toBe("true");
    expect(
      await page.getByRole("button", { name: "Save allocations", exact: true }).isDisabled(),
    ).toBe(true);
    let releaseLint!: () => void;
    const heldLint = new Promise<void>((resolve) => {
      releaseLint = resolve;
    });
    await page.route("**/api/declarations/lint", async (route) => {
      await heldLint;
      await route.continue();
    });
    try {
      await page.getByLabel("beta allocation", { exact: true }).fill("39");
      await page.getByRole("status").filter({ hasText: "Checking…" }).waitFor();
      expect(
        await page.getByLabel("alpha allocation", { exact: true }).getAttribute("aria-invalid"),
      ).toBe("true");
      expect(await page.locator(".portfolio-problems").innerText()).toContain("total 110%");
    } finally {
      releaseLint();
    }
    await page
      .locator(".portfolio-problems")
      .getByText(/total 109%/)
      .waitFor();
    await page.unroute("**/api/declarations/lint");
    await page.getByLabel("beta allocation", { exact: true }).fill("30");
    await page.waitForFunction(
      () =>
        !document
          .querySelector<HTMLInputElement>('input[aria-label="alpha allocation"]')
          ?.getAttribute("aria-invalid")
          ?.includes("true"),
    );
    await page.reload();
    await page.getByLabel("alpha allocation", { exact: true }).waitFor();
    expect(await page.getByLabel("alpha allocation", { exact: true }).inputValue()).toBe("70");
    await page.getByRole("button", { name: "Save allocations", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByText(`${f.configuration.processRepository.url} · main`, { exact: true })
      .waitFor();
    const saveIds: string[] = [];
    await page.route("**/api/declarations/save", async (route) => {
      const body = route.request().postDataJSON() as { saveId: string };
      saveIds.push(body.saveId);
      const response = await route.fetch();
      if (saveIds.length === 1) {
        expect(response.status()).toBe(200);
        await route.fulfill({
          status: 502,
          json: { error: "remote", message: "Sample reply lost after push" },
        });
      } else await route.fulfill({ response });
    });
    await page.getByRole("button", { name: "Commit and push", exact: true }).click();
    await page.getByRole("dialog").getByText("Sample reply lost after push").waitFor();
    await page.getByRole("dialog").getByRole("button", { name: "Try again", exact: true }).click();
    await page
      .getByRole("status")
      .filter({ hasText: /^Already saved as [0-9a-f]{7}$/ })
      .waitFor();
    expect(saveIds).toHaveLength(2);
    expect(saveIds[0]).toBe(saveIds[1]);
    const remoteHead = await git.resolveRef({ fs, gitdir: f.remote.gitdir, ref: "main" });
    expect(service.portfolio.current().commit).toBe(remoteHead);
    const saved = await service.processRepository.current()!.read("portfolio.yml");
    expect(saved).toContain("# allocation comment");
    expect(saved).toContain("70");
    await page.reload();
    await alpha.getByText(/^70%/).waitFor();
    await alpha.getByText("$7.00", { exact: true }).waitFor();
    const commits = await git.log({ fs, gitdir: f.remote.gitdir, ref: "main" });
    expect(
      commits.filter((c) => c.commit.message.startsWith("Update portfolio allocations")),
    ).toHaveLength(1);
    const reads = { portfolio: 0, source: 0 };
    page.on("request", (request) => {
      if (request.url().endsWith("/api/portfolio")) reads.portfolio++;
      if (request.url().includes("/api/declarations/source")) reads.source++;
    });
    service.portfolio.ledger.postActual({
      key: "focus-actual",
      actor: "task:focus",
      item: "alpha",
      account: "acct-a",
      amount: 200000,
      usedAt: Date.now(),
    });
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      window.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      window.dispatchEvent(new Event("visibilitychange"));
    });
    await page
      .locator(".portfolio-budget-card")
      .filter({ hasText: "acct-a" })
      .getByText("$0.2177", { exact: true })
      .waitFor();
    expect(reads.portfolio).toBeGreaterThan(0);
    expect(reads.source).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await service.stop();
    await f.close();
  }
});

test("accounts-only revisions update warnings and survive service restart without changing the portfolio commit", async () => {
  const f = await serviceFixture();
  let service = await startService({ configurationFile: f.file, log: () => {} });
  try {
    const portfolioCommit = service.portfolio.current().commit;
    const account = {
      unit: "usd",
      kind: "api",
      capacity: { amount: 10, reset: "2026-01-01T00:00:00Z", every: { days: 1 } },
    };
    const read = async () => {
      const address = service.http.address();
      const response = await fetch(`http://${address.host}:${address.port}/api/portfolio`);
      expect(response.status).toBe(200);
      return await response.json();
    };
    expect((await read()).warnings).toHaveLength(2);
    async function setAccounts(accounts: Record<string, unknown>) {
      const parent = await git.resolveRef({ fs, gitdir: f.remote.gitdir, ref: "main" }),
        old = await git.readCommit({ fs, gitdir: f.remote.gitdir, oid: parent }),
        root = await git.readTree({ fs, gitdir: f.remote.gitdir, oid: old.commit.tree }),
        blob = await git.writeBlob({
          fs,
          gitdir: f.remote.gitdir,
          blob: Buffer.from(stringify({ accounts })),
        }),
        tree = await git.writeTree({
          fs,
          gitdir: f.remote.gitdir,
          tree: [
            ...root.tree.filter((e) => e.path !== "accounts.yml"),
            { path: "accounts.yml", mode: "100644", type: "blob", oid: blob },
          ],
        }),
        commit = await git.writeCommit({
          fs,
          gitdir: f.remote.gitdir,
          commit: { ...old.commit, tree, parent: [parent], message: "Adjust sample accounts" },
        });
      await f.remote.force(commit);
      await service.revisions.pull();
    }
    await setAccounts({ acct: account });
    expect((await read()).warnings).toEqual([]);
    expect(service.portfolio.current().commit).toBe(portfolioCommit);
    const credits = () =>
      service.store.connection.database
        .prepare("SELECT COUNT(*) AS count FROM ledger_entries WHERE kind='credit'")
        .get() as { count: number };
    expect(credits().count).toBe(1);
    await read();
    expect(credits().count).toBe(1);
    await service.stop();
    service = await startService({ configurationFile: f.file, log: () => {} });
    expect((await read()).warnings).toEqual([]);
    expect(service.portfolio.current().commit).toBe(portfolioCommit);
    await setAccounts({});
    expect((await read()).warnings).toHaveLength(2);
    await service.stop();
    service = await startService({ configurationFile: f.file, log: () => {} });
    expect((await read()).warnings).toHaveLength(2);
    expect(service.portfolio.current().commit).toBe(portfolioCommit);
  } finally {
    await service.stop();
    await f.close();
  }
});

test("item dialogs preserve ids, add and remove sub-items, archive, and restore at zero", async () => {
  const f = await serviceFixture();
  await git.setConfig({ fs, gitdir: f.remote.gitdir, path: "http.receivepack", value: true });
  const service = await startService({ configurationFile: f.file, log: () => {} }),
    browser = await chromium.launch({ headless: true });
  try {
    const address = service.http.address(),
      page = await browser.newPage();
    page.setDefaultTimeout(5000);
    await page.goto(`http://${address.host}:${address.port}/console/portfolio`);
    await page.getByRole("button", { name: "Add item", exact: true }).click();
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("New collection");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Edit New collection", exact: true }).waitFor();
    expect(
      service.portfolio
        .current()
        .declaration.items.some((i) => i.id === "new-collection" && i.title === "New collection"),
    ).toBe(true);
    await page.getByRole("button", { name: "Edit New collection", exact: true }).click();
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Renamed collection");
    await page.getByRole("button", { name: "Add sub-item", exact: true }).click();
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Edit Renamed collection", exact: true }).waitFor();
    expect(
      service.portfolio.current().declaration.items.filter((i) => i.parent === "new-collection"),
    ).toEqual([]);
    await page.getByRole("button", { name: "Edit Renamed collection", exact: true }).click();
    await page.getByRole("button", { name: "Archive item", exact: true }).click();
    await page.getByRole("button", { name: "Confirm archive", exact: true }).click();
    await page.getByRole("button", { name: "Show archived (1)", exact: true }).waitFor();
    await page.getByRole("button", { name: "Show archived (1)", exact: true }).click();
    await page.getByRole("button", { name: "Restore", exact: true }).click();
    await page.getByRole("button", { name: "Edit Renamed collection", exact: true }).waitFor();
    expect(
      service.portfolio.current().declaration.items.find((i) => i.id === "new-collection")
        ?.archived,
    ).toBe(false);
  } finally {
    await browser.close();
    await service.stop();
    await f.close();
  }
});

test("Portfolio screen keeps nested remainders, changed-parent status, project counts and typed conflicts", async () => {
  const f = await serviceFixture();
  const reset = "2026-01-01T00:00:00Z";
  await f.commit(50, {
    accounts: {
      accounts: {
        "acct-a": { unit: "usd", kind: "api", capacity: { amount: 10, reset, every: { days: 1 } } },
        "acct-b": {
          unit: "usd",
          kind: "subscription",
          capacity: { amount: 20, reset, every: { days: 7 } },
        },
      },
    },
  });
  await git.setConfig({ fs, gitdir: f.remote.gitdir, path: "http.receivepack", value: true });
  const service = await startService({ configurationFile: f.file, log: () => {} }),
    browser = await chromium.launch({ headless: true });
  try {
    const text =
      "items:\n  alpha:\n    allocations:\n      acct-a: { guarantee: 50 }\n    items:\n      gamma:\n        allocations:\n          acct-a: { guarantee: 8.04 }\n      other:\n        allocations:\n          acct-a: { guarantee: 20 }\n  beta:\n    allocations:\n      acct-a: { guarantee: 50 }\n";
    await service.revisions.save({
      base: service.processRepository.current()!.commit,
      message: "Declare nested budgets",
      saveId: "3".repeat(32),
      files: [{ path: "portfolio.yml", text: text }],
    });
    const address = service.http.address(),
      url = `http://${address.host}:${address.port}`,
      page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.setDefaultTimeout(5000);
    let longNames = true;
    await page.route("**/api/portfolio", async (route) => {
      const response = await route.fetch(),
        body = await response.json();
      delete body.accounts.find((a: { name: string }) => a.name === "acct-b").window;
      body.items.find((i: { id: string }) => i.id === "alpha").projects = longNames
        ? {
            github: [
              { binding: "a".repeat(64), owner: "example", number: 1 },
              { binding: "b".repeat(64), owner: "example", number: 2 },
            ],
            t3code: [{ environment: "local", project: "sample", via: "association" }],
          }
        : { github: [{ binding: "sample", owner: "example", number: 1 }], t3code: [] };
      await route.fulfill({ response, json: body });
    });
    await page.goto(url + "/console/portfolio?account=unknown");
    expect(await page.getByLabel("Allocations for").inputValue()).toBe("acct-a");
    const card = page.locator(".portfolio-budget-card").filter({ hasText: "acct-b" });
    await card.getByText("No window yet").waitFor();
    expect(await card.getByRole("meter").getAttribute("aria-valuenow")).toBe("0");
    await page.getByText("2 GitHub Projects, 1 T3code project", { exact: true }).waitFor();
    longNames = false;
    await page.getByRole("button", { name: "Refresh portfolio" }).click();
    await page.locator(".portfolio-projects").filter({ hasText: "sample · example/1" }).waitFor();
    await page.getByRole("button", { name: "Edit alpha", exact: true }).click();
    await page.getByRole("dialog").getByText("71.96% unallocated", { exact: true }).waitFor();
    expect(await page.getByRole("button", { name: "Archive item" }).isDisabled()).toBe(true);
    await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Edit allocations", exact: true }).click();
    await page.getByLabel("gamma allocation", { exact: true }).fill("70");
    const status = page.getByRole("status").filter({ hasText: "alpha ·" });
    await status.getByText("alpha · 10% unallocated", { exact: true }).waitFor();
    expect(await status.innerText()).not.toContain("Top level");
    const nestedRemainder = page.getByRole("row").filter({ hasText: "Unallocated" }).nth(0);
    expect(await nestedRemainder.innerText()).toContain("10%");
    await nestedRemainder.getByText("$0.50", { exact: true }).waitFor();
    let reason = "file-changed";
    await page.route("**/api/declarations/save", (route) =>
      route.fulfill({
        status: 409,
        json: {
          error: "conflict",
          message: "Sample conflict",
          reason,
          head: service.processRepository.current()!.commit,
          text,
        },
      }),
    );
    await page.getByRole("button", { name: "Save allocations", exact: true }).click();
    await page.getByRole("button", { name: "Commit and push", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "portfolio.yml changed on main at" }).waitFor();
    await page.getByRole("button", { name: "Apply my changes to the latest", exact: true }).click();
    await page.getByRole("button", { name: "Save allocations", exact: true }).click();
    reason = "branch-moved";
    await page.getByRole("button", { name: "Commit and push", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "main moved while saving, at" }).waitFor();
  } finally {
    await browser.close();
    await service.stop();
    await f.close();
  }
});
