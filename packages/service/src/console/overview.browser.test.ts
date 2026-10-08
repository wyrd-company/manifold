// ---
// relationships:
//   verifies: [operator-console, tasks-api, portfolio-api, escalation-contract]
// ---
import { chromium } from "playwright";
import { expect, test } from "vite-plus/test";
import { overviewWorld } from "./test-fixtures/overview.ts";

test("built Overview joins live reads, shows nested budgets and refreshes attention", async () => {
  const f = await overviewWorld(),
    browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.setDefaultTimeout(3000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(f.url + "/console/");
    const tile = (name: string) => page.getByRole("region", { name, exact: true });
    await tile("Active actors").getByText("3", { exact: true }).waitFor();
    await tile("Active actors").getByText("1 held", { exact: true }).waitFor();
    await tile("Needs attention").getByText("3", { exact: true }).waitFor();
    await tile("Needs attention")
      .getByText("1 escalation · 1 held · 1 paused", { exact: true })
      .waitFor();
    await tile("Closest to limit").getByText("85%", { exact: true }).waitFor();
    expect(await tile("Closest to limit").getByRole("meter").getAttribute("class")).toContain(
      "warning",
    );
    await tile("Closest to limit").getByText("acct-a · Weekly", { exact: true }).waitFor();
    await tile("Environments").getByText("1 of 2 connected", { exact: true }).waitFor();
    await tile("Environments").getByText("1 paused", { exact: true }).waitFor();
    const table = page.getByRole("region", { name: "Active actors table" });
    await table.getByText("Held", { exact: true }).waitFor();
    expect(await table.getByRole("link", { name: "Open thread" }).getAttribute("href")).toBe(
      "https://example.test/environment/thread-1",
    );
    const attention = page.getByRole("region", { name: "Needs attention list" });
    expect(await attention.locator(".overview-attention-title").allTextContents()).toEqual([
      "Delivery question",
      "Collect parcel is held",
      "south is paused",
    ]);
    const budgets = page.getByRole("region", { name: "Budget" });
    const row = (name: string) =>
      budgets
        .locator(".overview-budget-row")
        .filter({ has: page.getByText(name, { exact: true }) });
    await row("alpha").getByText("Near limit", { exact: true }).waitFor();
    await row("alpha").getByText("$4.25 of $5.00 · 85%", { exact: true }).waitFor();
    expect(await row("beta").getByText("Near limit").count()).toBe(0);
    await row("beta-one").getByText("Near limit", { exact: true }).waitFor();
    expect(
      await row("beta-one")
        .locator("strong")
        .evaluate((e) => getComputedStyle(e).paddingLeft),
    ).toBe("16px");
    f.ask();
    await page.getByRole("button", { name: "Refresh overview" }).click();
    await tile("Needs attention").getByText("4", { exact: true }).waitFor();
    await attention.getByRole("link", { name: "Open task", exact: true }).first().click();
    await page.getByRole("heading", { name: "Deliver parcel", exact: true }).waitFor();
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await f.close();
  }
});

test.each([true, false])(
  "environment failure (%s initially) leaves independent reads visible and retry restores it",
  async (initiallyFailed) => {
    const f = await overviewWorld(),
      browser = await chromium.launch({ headless: true });
    try {
      f.failEnvironments(initiallyFailed);
      const page = await browser.newPage();
      page.setDefaultTimeout(3000);
      await page.goto(f.url + "/console/");
      const environments = page.getByRole("region", { name: "Environments", exact: true });
      const attention = page.getByRole("region", { name: "Needs attention list" });
      if (!initiallyFailed) {
        await environments.getByText("1 of 2 connected").waitFor();
        await attention.getByText("south is paused").waitFor();
        f.failEnvironments(true);
        await page.getByRole("button", { name: "Refresh overview" }).click();
      }
      await environments.getByText("—", { exact: true }).waitFor();
      await environments.getByText("Not available", { exact: true }).waitFor();
      await attention
        .getByRole("alert")
        .getByText("Cannot read environments. Check the connection and try again.")
        .waitFor();
      await page
        .getByRole("region", { name: "Needs attention", exact: true })
        .getByText("2", { exact: true })
        .waitFor();
      expect(await attention.getByText("south is paused").count()).toBe(0);
      await page
        .getByRole("region", { name: "Active actors", exact: true })
        .getByText("3", { exact: true })
        .waitFor();
      await page
        .getByRole("region", { name: "Closest to limit" })
        .getByText("85%", { exact: true })
        .waitFor();
      await page
        .getByRole("region", { name: "Budget" })
        .getByText("$4.25 of $5.00 · 85%")
        .waitFor();
      f.failEnvironments(false);
      await attention.getByRole("button", { name: "Try again" }).click();
      await environments.getByText("1 of 2 connected").waitFor();
      await page
        .getByRole("region", { name: "Needs attention", exact: true })
        .getByText("3", { exact: true })
        .waitFor();
    } finally {
      await browser.close();
      await f.close();
    }
  },
);
