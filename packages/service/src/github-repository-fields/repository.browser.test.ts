// ---
// relationships:
//   verifies: [operator-console, task-metadata, declarations-api]
// ---
import { chromium } from "playwright";
import { expect, test } from "vite-plus/test";
import { repositoryConsole } from "./test-fixtures/console.ts";
test("built Task fields configures label and milestone storage, scope, drift policy, and Publish impact", async () => {
  const h = await repositoryConsole();
  const browser = await chromium.launch({ headless: true });
  try {
    await h.configuration.projects.apply("delivery", { removeUndeclared: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(h.url + "/console/settings/task-fields");
    await page.getByRole("button", { name: "size", exact: true }).click();
    await page.getByLabel("Label prefix", { exact: true }).waitFor();
    await page.getByText("Repositories sample/depot", { exact: true }).waitFor();
    await page.getByRole("heading", { name: "On GitHub", exact: true }).waitFor();
    await page.getByRole("button", { name: "Revert", exact: true }).click();
    await expect
      .poll(() =>
        page.getByRole("button", { name: "Revert", exact: true }).getAttribute("aria-pressed"),
      )
      .toBe("true");
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await page.getByLabel("Storage of batch").selectOption("label");
    await expect.poll(() => page.getByLabel("Storage of batch").inputValue()).toBe("label");
    await page.getByRole("button", { name: "batch", exact: true }).click();
    await page.getByLabel("Label prefix").waitFor();
    await page.getByLabel("Storage of batch").selectOption("milestone");
    await expect.poll(() => page.getByLabel("Storage of batch").inputValue()).toBe("milestone");
    expect(await page.getByLabel("Label prefix").count()).toBe(0);
    h.platform.addRepository("sample/warehouse");
    const repositories = page.getByLabel("Repositories of delivery");
    await repositories.fill("sample/depot, sample/warehouse");
    await repositories.press("Enter");
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByLabel("Commit message").fill("Configure repository fields");
    // The impact includes the two labels and milestone of the newly named repository.
    const impact = page.getByRole("dialog").getByRole("row").filter({ hasText: "delivery" });
    expect(await impact.getByRole("cell").nth(1).innerText()).toBe("3");
    await page.getByRole("button", { name: "Commit and push", exact: true }).click();
    await page
      .getByRole("status")
      .filter({ hasText: /^Saved as [0-9a-f]+$/ })
      .waitFor();
    const current = await h.service.processRepository.current()!.read("task-metadata.yml");
    expect(current).toContain("sample/warehouse");
    expect(current).toContain("kind: milestone");
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await h.close();
  }
});
test("built Projects shows outside repositories, performs Apply, and blocks refused repository scopes", async () => {
  const h = await repositoryConsole();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    await page.goto(h.url + "/console/projects/delivery");
    await page.getByText("elsewhere/outside (1 issues) outside", { exact: false }).waitFor();
    await page.getByRole("button", { name: "Apply 1 changes", exact: true }).click();
    await page.getByText("In sync", { exact: true }).first().waitFor();
    h.addRemoval();
    h.platform.deny(403);
    await page.reload();
    await page.getByText("sample/depot: forbidden", { exact: false }).waitFor();
    await page
      .getByRole("switch", { name: "Also remove what the task fields do not define" })
      .check();
    const apply = page.getByRole("button", { name: /^Apply/ });
    expect(await apply.isDisabled()).toBe(true);
    const response = await fetch(h.url + "/api/projects/delivery/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeUndeclared: true }),
    });
    expect(response.status).toBe(409);
  } finally {
    await browser.close();
    await h.close();
  }
});
