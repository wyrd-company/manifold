// ---
// relationships:
//   verifies: [operator-console, accounts-declaration, declarations-api]
// ---
import { chromium } from "playwright";
import { expect, test } from "vite-plus/test";
import * as fs from "node:fs/promises";
import git from "isomorphic-git";
import { parse, stringify } from "yaml";
import { serviceFixture } from "../service/test-fixtures/repository.ts";
import { startService } from "../service/index.ts";
test("Accounts adds, edits, retries a saved commit, archives and restores through the running service", async () => {
  const f = await serviceFixture();
  await git.setConfig({ fs, gitdir: f.remote.gitdir, path: "http.receivepack", value: true });
  await f.commit(50, {
    prices: { unit: "usd", models: { "model-a": { standard: { input: 2, output: 8 } } } },
  });
  await fs.writeFile(f.directory + "/environment.token", "sample-token");
  await fs.writeFile(
    f.file,
    stringify({
      ...f.configuration,
      credentials: {
        ...f.configuration.credentials,
        environment: { kind: "t3code-token", tokenFile: "environment.token" },
      },
      environments: {
        "env-one": { url: "http://127.0.0.1:1", credential: "environment" },
        "env-two": { url: "http://127.0.0.1:1", credential: "environment" },
      },
    }),
  );
  let service = await startService({ configurationFile: f.file, log: () => {} });
  const browser = await chromium.launch({ headless: true });
  try {
    const seeded = await service.revisions.save({
      base: service.processRepository.current()!.commit,
      message: "Declare sample account",
      saveId: "1".repeat(32),
      files: [
        {
          path: "accounts.yml",
          text: "# account comment\naccounts:\n  acct:\n    unit: usd\n    kind: api\n    capacity: { amount: 250, reset: '2026-01-01T00:00:00Z', every: { months: 1 } }\n    usage: [{ environment: env-one, provider: claude }]\n",
        },
      ],
    });
    expect(seeded.outcome).toBe("saved");
    const url = `http://127.0.0.1:${service.http.address().port}`;
    const pushed = await fetch(url + "/api/usage/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        environment: "env-one",
        threads: [],
        records: [
          {
            type: "call",
            key: "call-one",
            provider: "claude",
            providerSessionId: "session-one",
            unit: { id: "session-one", kind: "session" },
            timestamp: new Date().toISOString(),
            model: "model-a",
            tokens: {
              input: 1000000,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              cacheWriteOneHour: 0,
              reasoning: 0,
              webSearchRequests: 0,
            },
            speed: "standard",
            granularity: "call",
            estimated: false,
          },
        ],
      }),
    });
    expect(pushed.status).toBe(200);
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url + "/console/settings/accounts");
    await page.getByRole("heading", { name: "Accounts and budget sources" }).waitFor();
    await page.getByText("$250.00 · Monthly", { exact: true }).waitFor();
    await page.getByText(/Price table: LiteLLM at/).waitFor();
    await page.getByText(/minutes ago/).waitFor();
    await page.getByRole("button", { name: "Add account", exact: true }).click();
    const dialog = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("heading", { name: "Add account", exact: true }) });
    await dialog.getByRole("button", { name: "Subscription", exact: true }).click();
    await dialog.getByLabel("Name", { exact: true }).fill("acct-b");
    await dialog.getByText("Used by acct", { exact: true }).waitFor();
    await dialog.getByLabel("env-one", { exact: true }).check();
    expect(await dialog.getByRole("button", { name: "Save", exact: true }).isDisabled()).toBe(true);
    await dialog.getByLabel("env-one instance 1", { exact: true }).fill("alt");
    await dialog.getByLabel("env-two", { exact: true }).check();
    await dialog.getByLabel("Usage limit per window").fill("120.50");
    await dialog.getByLabel("Window", { exact: true }).selectOption("weekly");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText("$120.50 · Weekly", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Edit acct-b", exact: true }).click();
    await page.getByLabel("Usage limit per window").fill("150");
    const ids: string[] = [];
    await page.route("**/api/declarations/save", async (route) => {
      ids.push(route.request().postDataJSON().saveId);
      const response = await route.fetch();
      if (ids.length === 1)
        await route.fulfill({
          status: 502,
          json: { error: "remote", message: "Sample reply lost" },
        });
      else await route.fulfill({ response });
    });
    await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText("Sample reply lost", { exact: false }).waitFor();
    await page.getByRole("dialog").getByRole("button", { name: "Try again", exact: true }).click();
    await page.getByText("$150.00 · Weekly", { exact: true }).waitFor();
    await page
      .getByRole("status")
      .filter({ hasText: /^Already saved as/ })
      .waitFor();
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
    await page.unroute("**/api/declarations/save");
    const read = await (await fetch(url + "/api/portfolio")).json();
    expect(read.accounts.find((a: { name: string }) => a.name === "acct-b")).toMatchObject({
      capacity: { amount: 150000000 },
    });
    const saved = await service.processRepository.current()!.read("accounts.yml");
    expect(saved).toContain("# account comment");
    expect(parse(saved!).accounts["acct-b"].capacity.amount).toBe(150);
    await page.getByRole("button", { name: "Edit acct", exact: true }).click();
    await page.getByRole("button", { name: "Archive account", exact: true }).click();
    const archive = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("heading", { name: "Archive acct?", exact: true }) });
    await archive.getByText("alpha", { exact: true }).waitFor();
    await archive.getByRole("button", { name: "Archive account", exact: true }).click();
    await page.getByRole("button", { name: "Show archived (1)", exact: true }).waitFor();
    await page.goto(url + "/console/portfolio");
    const restoreLink = page.getByRole("link", {
      name: "Restore it in Settings, Accounts",
      exact: true,
    });
    expect(await restoreLink.getAttribute("href")).toBe("/console/settings/accounts");
    await restoreLink.click();
    await page.getByRole("heading", { name: "Accounts and budget sources", exact: true }).waitFor();
    const archivedRead = await (await fetch(url + "/api/portfolio")).json();
    expect(archivedRead.warnings).toContainEqual(
      expect.objectContaining({
        kind: "account-archived",
        details: { account: "acct", item: "alpha" },
      }),
    );
    expect(
      service.portfolio.ledger.balance({ item: "alpha", account: "acct", waiting: [] }).reservable,
    ).toBe(0);
    expect(service.usage.lastUsedAt()).toHaveProperty("acct");
    await service.stop();
    service = await startService({ configurationFile: f.file, log: () => {} });
    expect(
      service.portfolio.ledger.balance({ item: "alpha", account: "acct", waiting: [] }).reservable,
    ).toBe(0);
    expect(service.usage.lastUsedAt()).toHaveProperty("acct");
    await page.goto(`http://127.0.0.1:${service.http.address().port}/console/settings/accounts`);
    await page.getByRole("button", { name: "Show archived (1)", exact: true }).click();
    await page.getByRole("button", { name: "Restore", exact: true }).click();
    await page.getByRole("button", { name: "Edit acct", exact: true }).waitFor();
    expect(errors).toEqual([]);
    const log = await git.log({ fs, gitdir: f.remote.gitdir, ref: "main" });
    expect(
      log.filter((c) => /^(Add account acct-b|Update account acct-b)/.test(c.commit.message)),
    ).toHaveLength(2);
  } finally {
    await browser.close();
    await service.stop();
    await f.close();
  }
}, 60000);

test("Accounts rebases a conflict and reuses the saved request while loading its commit", async () => {
  const f = await serviceFixture();
  await git.setConfig({ fs, gitdir: f.remote.gitdir, path: "http.receivepack", value: true });
  const service = await startService({ configurationFile: f.file, log: () => {} });
  const browser = await chromium.launch({ headless: true });
  try {
    const text =
      "# original comment\naccounts:\n  acct:\n    unit: usd\n    kind: api\n    capacity: { amount: 10, reset: '2026-01-01T01:00:00+01:00', every: { days: 1 } }\n    usage: [{ environment: env-one, provider: codex, instance: first }, { environment: env-one, provider: codex, instance: second }]\n";
    await service.revisions.save({
      base: service.processRepository.current()!.commit,
      message: "Declare sample account",
      saveId: "1".repeat(32),
      files: [{ path: "accounts.yml", text: text }],
    });
    const url = `http://127.0.0.1:${service.http.address().port}`;
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    await page.goto(url + "/console/settings/accounts");
    await page.getByRole("button", { name: "Edit acct", exact: true }).click();
    expect(await page.getByLabel("Name", { exact: true }).isDisabled()).toBe(true);
    expect(await page.getByLabel("env-one instance 1", { exact: true }).inputValue()).toBe("first");
    expect(await page.getByLabel("env-one instance 2", { exact: true }).inputValue()).toBe(
      "second",
    );
    const checked = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/declarations/lint") &&
        response.request().postDataJSON().text.includes("amount: 20"),
    );
    await page.getByLabel("Budget per window").fill("20");
    await checked;
    await page.waitForFunction(() =>
      [...document.querySelectorAll<HTMLButtonElement>("button")].some(
        (button) => button.textContent === "Save" && !button.disabled,
      ),
    );
    let releaseLint!: () => void;
    const heldLint = new Promise<void>((resolve) => {
      releaseLint = resolve;
    });
    await page.route("**/api/declarations/lint", async (route) => {
      await heldLint;
      await route.continue();
    });
    try {
      await page.getByLabel("Budget per window").fill("30");
      expect(await page.getByRole("button", { name: "Save", exact: true }).isDisabled()).toBe(true);
      await page.getByLabel("Budget per window").fill("20");
    } finally {
      releaseLint();
    }
    await page.unrouteAll({ behavior: "wait" });
    await service.revisions.save({
      base: service.processRepository.current()!.commit,
      message: "Change sample comment",
      saveId: "2".repeat(32),
      files: [
        { path: "accounts.yml", text: text.replace("# original comment", "# latest comment") },
      ],
    });
    const ids: string[] = [];
    await page.route("**/api/declarations/save", async (route) => {
      ids.push(route.request().postDataJSON().saveId);
      const response = await route.fetch();
      if (response.status() === 200 && ids.length === 2)
        await route.fulfill({ status: 200, json: { ...(await response.json()), loaded: false } });
      else await route.fulfill({ response });
    });
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Apply my changes to the latest", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText(/The service has not loaded it yet/).waitFor();
    await page.getByRole("button", { name: "Load saved version", exact: true }).click();
    await page
      .getByRole("status")
      .filter({ hasText: /^Already saved as/ })
      .waitFor();
    expect(ids).toHaveLength(3);
    expect(ids[0]).not.toBe(ids[1]);
    expect(ids[1]).toBe(ids[2]);
    const saved = await service.processRepository.current()!.read("accounts.yml");
    expect(saved).toContain("# latest comment");
    expect(parse(saved!).accounts.acct.usage).toEqual(parse(text).accounts.acct.usage);
    expect(parse(saved!).accounts.acct.capacity.amount).toBe(20);
  } finally {
    await browser.close();
    await service.stop();
    await f.close();
  }
});

test("Accounts shows declaration shape errors and read failures without edit controls", async () => {
  const f = await serviceFixture();
  await f.commit(50, { accounts: { accounts: [] } });
  const service = await startService({ configurationFile: f.file, log: () => {} });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    await page.goto(`http://127.0.0.1:${service.http.address().port}/console/settings/accounts`);
    await page
      .getByRole("alert")
      .filter({ hasText: /cannot be edited here/ })
      .waitFor();
    expect(await page.getByRole("button", { name: "Add account", exact: true }).count()).toBe(0);
    expect(await page.getByRole("table").count()).toBe(0);
    await page.route("**/api/portfolio", (route) =>
      route.fulfill({ status: 500, json: { error: "internal", message: "Sample read failed" } }),
    );
    await page.getByRole("button", { name: "Refresh accounts", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Sample read failed" }).waitFor();
    expect(await page.getByRole("button", { name: "Try again", exact: true }).count()).toBe(1);
  } finally {
    await browser.close();
    await service.stop();
    await f.close();
  }
});
