// ---
// relationships:
//   verifies: [operator-console, task-metadata, declarations-api]
// ---
import { chromium } from "playwright";
import { expect, test } from "vite-plus/test";
import { organizationHost } from "./test-fixtures/organization-host.ts";

test("Task fields configures organization kinds, type findings, shared scope, Revert/Accept and Publish impact", async () => {
  const f = await organizationHost();
  const browser = await chromium.launch({ headless: true });
  try {
    await f.service.taskMetadata.projects.apply("first", { removeUndeclared: false });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(f.url + "/console/settings/task-fields");
    const group = page.locator(".fields-table section").first();
    await group.getByRole("button", { name: "priority", exact: true }).click();
    await page.getByLabel("Organization", { exact: true }).waitFor();
    expect(await page.getByLabel("Organization", { exact: true }).inputValue()).toBe("sample");
    await page.getByText("Shared with second", { exact: false }).waitFor();
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await expect
      .poll(() =>
        page.getByRole("button", { name: "Accept", exact: true }).getAttribute("aria-pressed"),
      )
      .toBe("true");
    await page.getByRole("button", { name: "Revert", exact: true }).click();
    await group.getByRole("button", { name: "Add field", exact: true }).click();
    const row = group.getByRole("row").filter({ hasText: "field-1" });
    await row.getByRole("combobox").nth(1).selectOption("issue-type");
    await page.getByText("Cannot hold text", { exact: true }).waitFor();
    await page
      .locator(".blueprint-finding")
      .filter({ hasText: "Storage cannot hold this type" })
      .waitFor();
    await row.getByRole("combobox").first().selectOption("single-select");
    await page.getByRole("button", { name: "Add option", exact: true }).click();
    await page.getByLabel("Option 1", { exact: true }).fill("Special");
    await page.getByLabel("Option 1", { exact: true }).blur();
    await row.getByRole("combobox").nth(1).selectOption("issue-field");
    await page.getByLabel("Issue field name", { exact: true }).fill("Routing");
    await page.getByLabel("Issue field name", { exact: true }).blur();
    await expect
      .poll(() => page.getByRole("button", { name: "Publish", exact: true }).isEnabled())
      .toBe(true);
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText("sample", { exact: false }).first().waitFor();
    await dialog.getByLabel("Commit message").fill("Add routing field");
    await dialog.getByRole("button", { name: "Commit and push", exact: true }).click();
    await page
      .getByRole("status")
      .filter({ hasText: /^Saved as [a-f0-9]+$/ })
      .waitFor();
    const current = f.service.taskMetadata.current();
    expect(current?.projects["first"]?.fields["field-1"]?.storage).toMatchObject({
      kind: "issue-field",
      name: "Routing",
    });
  } finally {
    await browser.close();
    await f.close();
  }
});

test("Projects applies organization changes, shows drift, and refuses an unavailable organization", async () => {
  const f = await organizationHost();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(f.url + "/console/projects/first");
    await page.getByRole("button", { name: "Apply 3 changes", exact: true }).click();
    await page.getByText("In sync", { exact: true }).first().waitFor();
    f.api.types[0]!.name = "Inquiry";
    await f.service.github.observeScope({ kind: "organization", organization: "sample" });
    await page.reload();
    await page.getByRole("button", { name: "Apply 1 changes", exact: true }).click();
    await page.getByText("In sync", { exact: true }).first().waitFor();
    expect(f.api.types[0]!.name).toBe("Request");
    f.api.owner("User");
    await page.reload();
    // Apply re-observes before any writes even when the displayed plan was ready.
    const refusal = page.waitForResponse(
      (r) => r.url().endsWith("/first/apply") && r.status() === 409,
    );
    f.api.types[0]!.name = "Different";
    await f.service.github.observeScope({ kind: "organization", organization: "sample" });
    await page.reload();
    // Unusable scope is visible; invoke the public Apply path from the built page.
    const result = await page.evaluate(async () => {
      const r = await fetch("/api/projects/first/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeUndeclared: false }),
      });
      return r.status;
    });
    await refusal;
    expect(result).toBe(409);
    expect(f.api.types[0]!.name).toBe("Different");
  } finally {
    await browser.close();
    await f.close();
  }
});

test("Task page shows the organization values observed through GitHub adapters", async () => {
  const f = await organizationHost();
  const browser = await chromium.launch({ headless: true });
  try {
    await f.service.taskMetadata.projects.apply("first", { removeUndeclared: false });
    const write = {
      actorId: "actor",
      invokeId: "set",
      entryId: "entry",
      issueNodeId: "I_A",
      projectNodeId: "P_one",
      field: "priority",
      storage: { kind: "issue-field" as const, organization: "sample", name: "Urgency" },
      labels: [],
      repositories: [],
      value: "High",
    };
    await f.service.github.writeTaskField(write);
    await f.service.github.writeTaskField({
      ...write,
      invokeId: "type",
      field: "category",
      storage: { kind: "issue-type", organization: "sample" },
      value: "Request",
    });
    await expect
      .poll(
        () =>
          f.service.taskMetadata.values("first", f.service.github.trackedIssue("I_A")!)?.[
            "priority"
          ],
      )
      .toEqual({ state: "set", value: "High" });
    const page = await browser.newPage();
    await page.goto(f.url + "/console/board/task/task%3AI_A");
    const priority = page.locator(".task-field").filter({ hasText: "priority" });
    await priority.getByText("High", { exact: true }).waitFor();
    await page
      .locator(".task-field")
      .filter({ hasText: "category" })
      .getByText("Request", { exact: true })
      .waitFor();
    expect(await priority.getByText("priority", { exact: true }).getAttribute("title")).toBe(
      "sample issue field Urgency",
    );
  } finally {
    await browser.close();
    await f.close();
  }
});
