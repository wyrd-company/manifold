// ---
// relationships:
//   verifies: [usage-api, operator-console]
// ---
import { chromium } from "playwright";
import { expect, test } from "vite-plus/test";
import { serviceFixture } from "../service/test-fixtures/repository.ts";
import { startService } from "../service/index.ts";
import type { UsageCall } from "@wyrd-company/manifold-shared";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify } from "yaml";
test("built Portfolio moves unowned calls, retains a refused task and replays an interrupted response", async () => {
  const f = await serviceFixture();
  const now = Date.now();
  await f.commit(50, {
    accounts: {
      accounts: {
        acct: {
          unit: "usd",
          kind: "api",
          capacity: {
            amount: 10,
            reset: new Date(now - 3600000).toISOString(),
            every: { hours: 1 },
          },
          usage: [{ environment: "env-one", provider: "codex" }],
        },
      },
    },
    prices: { unit: "usd", models: { "model-a": { standard: { input: 2, output: 8 } } } },
  });
  await writeFile(join(f.directory, "environment.token"), "example-token");
  await writeFile(
    f.file,
    stringify({
      ...f.configuration,
      credentials: {
        ...f.configuration.credentials,
        environment: { kind: "t3code-token", tokenFile: "environment.token" },
      },
      environments: { "env-one": { url: "http://127.0.0.1:1", credential: "environment" } },
    }),
  );
  const service = await startService({ configurationFile: f.file, log: () => {} });
  const browser = await chromium.launch({ headless: true });
  try {
    const { host, port } = service.http.address();
    const url = `http://${host}:${port}`;
    service.portfolio.ledger.credit({
      key: "sample-credit",
      account: "acct",
      window: "sample-window",
      opensAt: now - 1000,
      closesAt: now + 3600000,
      amount: 10000000,
    });
    const call: UsageCall = {
      type: "call",
      key: "call-1",
      provider: "codex",
      providerSessionId: "session-1",
      unit: { id: "session-1", kind: "session" },
      timestamp: new Date(now).toISOString(),
      model: "model-a",
      tokens: {
        input: 10000,
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
    };
    service.usage.push({ environment: "env-one", threads: [], records: [call] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    page.setDefaultTimeout(3000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/tasks", (route) =>
      route.fulfill({
        json: {
          projects: [
            {
              binding: "sample",
              owner: "example",
              number: 1,
              item: "alpha",
              tasks: [
                {
                  actorId: "task:parcel",
                  issue: {
                    nodeId: "parcel",
                    repository: "example/delivery",
                    number: 2,
                    state: "open",
                    title: "Deliver parcel",
                  },
                  status: null,
                  openEscalations: 0,
                },
              ],
            },
          ],
        },
      }),
    );
    await page.goto(url + "/console/portfolio");
    const section = page.locator(".unowned-usage");
    await expect.poll(() => page.locator("body").innerText()).toContain("Unmapped session");
    await section.getByRole("button", { name: "Move", exact: true }).click();
    const dialog = page.locator(".usage-move-dialog");
    await dialog.getByLabel("Portfolio item", { exact: true }).selectOption("alpha");
    await dialog.getByRole("button", { name: "Move", exact: true }).click();
    await expect.poll(() => page.locator("body").innerText()).toContain("Moved 1 calls to alpha");
    expect(
      service.portfolio.ledger.balance({ item: "alpha", account: "acct", waiting: [] }).actual,
    ).toBe(20000);
    await section.getByRole("button", { name: "Move", exact: true }).click();
    // Refusal keeps the dialog open and the target available for retry.
    await dialog.getByText("To a task", { exact: true }).click();
    await dialog.getByLabel("Search tasks").fill("parcel");
    await page.getByRole("option", { name: "example/delivery#2 Deliver parcel" }).click();
    await dialog.getByLabel("Search tasks").fill("unknown");
    expect(
      await dialog
        .getByRole("button", { name: "Move", exact: true, includeHidden: true })
        .isDisabled(),
    ).toBe(true);
    await dialog.getByLabel("Search tasks").fill("parcel");
    await page.getByRole("option", { name: "example/delivery#2 Deliver parcel" }).click();
    await dialog.getByRole("button", { name: "Move", exact: true }).click();
    await dialog
      .getByRole("alert")
      .getByText("This task has not started, so its usage cannot be counted yet.")
      .waitFor();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await page.unroute("**/api/tasks");
    await section.getByRole("button", { name: "Move", exact: true }).click();
    await dialog.getByLabel("Portfolio item", { exact: true }).selectOption("beta");
    let interrupted = false;
    await page.route("**/api/usage/moves", async (route) => {
      if (!interrupted) {
        interrupted = true;
        await route.fetch();
        await route.abort();
      } else await route.continue();
    });
    await dialog.getByRole("button", { name: "Move", exact: true }).click();
    await dialog.getByRole("alert").waitFor();
    await dialog.getByRole("button", { name: "Move", exact: true }).click();
    await section.getByText("Nothing left to move.", { exact: true }).waitFor();
    expect(
      service.portfolio.ledger.balance({ item: "beta", account: "acct", waiting: [] }).actual,
    ).toBe(20000);
    await page.reload();
    await section
      .getByRole("row")
      .filter({ hasText: "Unmapped session" })
      .getByText("beta", { exact: true })
      .waitFor();
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await service.stop();
    await f.close();
  }
});
