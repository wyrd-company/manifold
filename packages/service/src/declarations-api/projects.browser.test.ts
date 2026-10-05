// ---
// relationships:
//   verifies: [operator-console, declarations-api]
// ---
import { chromium } from "playwright";
import type { Page } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { projectsHost } from "./test-fixtures/projects-host.ts";

async function capture(page: Page, name: string) {
  const directory = process.env["SCREENSHOTS_DIR"];
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: join(directory, `${name}.png`), fullPage: true });
}

test("Projects reviews drift, reconfirms stale removals, and recognizes another channel's Apply", async () => {
  const fixture = await projectsHost();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.setDefaultTimeout(4000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(fixture.url + "/console/projects");
    const row = page.getByRole("row").filter({ hasText: "example/1" });
    await row.getByText("Drift · 2", { exact: true }).waitFor();
    await row.getByRole("cell", { name: "2", exact: true }).waitFor();
    expect(await row.getByRole("cell").nth(3).innerText()).toBe("0");
    await capture(page, "projects-drift");
    await row.getByRole("link", { name: "Review changes", exact: true }).click();
    await page.getByText("Kept", { exact: true }).waitFor();
    await page
      .getByRole("switch", { name: "Also remove what the task fields do not define" })
      .check();
    await page.getByRole("button", { name: "Apply 2 changes", exact: true }).click();
    await page.getByRole("dialog").getByText("Obsolete", { exact: false }).waitFor();
    fixture.addRemoval();
    await page.getByRole("button", { name: "Apply and remove", exact: true }).click();
    await page
      .getByText("The plan changed since you reviewed it. Review the changes, then apply again.", {
        exact: true,
      })
      .waitFor();
    await page.getByRole("button", { name: "Apply 3 changes", exact: true }).click();
    await page.getByRole("dialog").getByText("Legacy", { exact: false }).waitFor();
    await page.getByRole("button", { name: "Apply and remove", exact: true }).click();
    await page.getByText("In sync", { exact: true }).first().waitFor();
    await page
      .getByText("Nothing to apply. The Project matches the task fields.", { exact: true })
      .waitFor();
    await capture(page, "projects-in-sync");
    await page.goto(fixture.url + "/console/projects/secondary");
    await page.getByRole("button", { name: "Apply 1 changes", exact: true }).waitFor();
    const plan = fixture.plan("secondary");
    const applied = await fetch(fixture.url + "/api/projects/secondary/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ digest: plan.digest, removeUndeclared: true }),
    });
    expect(applied.status).toBe(200);
    await page.getByRole("button", { name: "Apply 1 changes", exact: true }).click();
    await page.getByText("Another Apply finished these changes first.", { exact: true }).waitFor();
    await page.getByText("In sync", { exact: true }).first().waitFor();
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await fixture.close();
  }
}, 30_000);

test("Task fields preserves invalid drafts, fixes YAML, and publishes through the real repository", async () => {
  const fixture = await projectsHost();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.setDefaultTimeout(4000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(fixture.url + "/console/settings/task-fields");
    await page.getByText("YAML", { exact: true }).waitFor();
    expect(await page.getByText("YAML", { exact: true }).getAttribute("role")).toBe("tab");
    await page.getByRole("tab", { name: "YAML", exact: true }).click();
    await page.locator(".cm-content").waitFor();
    const original = await page.locator(".cm-content").innerText();
    await page.locator(".cm-content").fill("projects: [");
    await page.locator(".blueprint-finding").first().waitFor();
    await capture(page, "task-fields-invalid-yaml");
    expect(await page.getByRole("button", { name: "Publish", exact: true }).isDisabled()).toBe(
      true,
    );
    await page.reload();
    await page.getByRole("tab", { name: "YAML", exact: true }).click();
    await page.locator(".cm-content").waitFor();
    expect(await page.locator(".cm-content").innerText()).toContain("projects: [");
    await page.locator(".cm-content").fill(original.replace("Delivered", "Collected"));
    await page.waitForFunction(
      () =>
        !Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
          (button) => button.textContent === "Publish",
        )?.disabled,
    );
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByLabel("Commit message").fill("Adjust parcel stage");
    await page.getByRole("button", { name: "Commit and push", exact: true }).click();
    await page
      .getByRole("status")
      .filter({ hasText: /^Saved as [0-9a-f]{7}$/ })
      .waitFor();
    const response = await fetch(fixture.url + "/api/declarations/source?path=task-metadata.yml");
    const source = (await response.json()) as { text: string; commit: string };
    expect(source.text).toContain("Collected");
    const revision = await fixture.service.processRepository.revisionAt(source.commit);
    expect(await revision!.read("task-metadata.yml")).toBe(source.text);
    await page.getByText(`Published ${source.commit.slice(0, 7)}`, { exact: false }).waitFor();
    await capture(page, "task-fields-published");
    await page.reload();
    await page.getByRole("tab", { name: "YAML", exact: true }).click();
    await page.locator(".cm-content").waitFor();
    expect(await page.locator(".cm-content").innerText()).toContain("Collected");
    expect(await page.getByRole("button", { name: "Publish", exact: true }).isDisabled()).toBe(
      true,
    );
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await fixture.close();
  }
}, 30_000);

test("Visual task fields locks lifecycle controls and selects a new field with schema findings", async () => {
  const fixture = await projectsHost();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.setDefaultTimeout(4000);
    await page.goto(fixture.url + "/console/settings/task-fields");
    const lifecycle = page.getByRole("row").filter({ hasText: "Stage" }).first();
    await lifecycle.waitFor();
    expect(await lifecycle.getByRole("combobox").first().isDisabled()).toBe(true);
    expect(await lifecycle.getByRole("combobox").nth(1).isDisabled()).toBe(true);
    expect(await lifecycle.getByRole("button", { name: "Remove field", exact: true }).count()).toBe(
      0,
    );
    await page.getByRole("button", { name: "Add field", exact: true }).first().click();
    await page.getByLabel("Field name", { exact: true }).waitFor();
    expect(await page.getByLabel("Field name", { exact: true }).inputValue()).toBe("field-1");
    const added = page.getByRole("row").filter({ hasText: "field-1" });
    await added.getByRole("combobox").first().selectOption("single-select");
    await page.locator(".blueprint-finding").filter({ hasText: "schema" }).first().waitFor();
    await capture(page, "task-fields-visual-finding");
    expect(await page.getByRole("button", { name: "Review impact", exact: true }).count()).toBe(0);
    expect(await page.getByRole("button", { name: "Publish", exact: true }).isDisabled()).toBe(
      true,
    );
    await page.getByRole("button", { name: "Add option", exact: true }).click();
    await page.waitForFunction(
      () =>
        !Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
          (button) => button.textContent === "Publish",
        )?.disabled,
    );
    expect(await page.locator(".blueprint-finding").count()).toBe(0);
    await capture(page, "task-fields-visual");
    await page.getByRole("tab", { name: "YAML", exact: true }).click();
    await page.locator(".cm-content").waitFor();
    expect(await page.locator(".cm-content").innerText()).toContain("field-1");
  } finally {
    await browser.close();
    await fixture.close();
  }
}, 30_000);

test("binding conflicts retain operator values and preserve another channel's comments on retry", async () => {
  const fixture = await projectsHost();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.setDefaultTimeout(4000);
    await page.goto(fixture.url + "/console/projects");
    await page.getByRole("button", { name: "Bind a Project", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Project", { exact: true }).fill("example/3");
    await dialog.getByLabel("Name", { exact: true }).fill("example-3");
    await dialog.getByRole("combobox", { name: /Portfolio item/ }).selectOption("alpha");
    await dialog.getByLabel("Parcel workspace", { exact: false }).check();
    await dialog.getByLabel("I understand", { exact: true }).check();
    await fixture.changeBindings();
    await dialog.getByRole("button", { name: "Bind and review changes", exact: true }).click();
    await dialog.getByText(/Your values are kept/).waitFor();
    expect(await dialog.getByLabel("Project", { exact: true }).inputValue()).toBe("example/3");
    expect(await dialog.getByLabel("Name", { exact: true }).inputValue()).toBe("example-3");
    expect(await dialog.getByLabel("Parcel workspace", { exact: false }).isChecked()).toBe(true);
    await dialog.getByRole("button", { name: "Try again", exact: true }).click();
    await page.getByText("Not applied", { exact: true }).first().waitFor();
    const text = await fixture.service.processRepository.current()!.read("bindings.yml");
    expect(text).toContain("# Keep this remote comment");
    expect(text).toContain("# Earlier remote change");
    expect(text).toContain("example-3:");
    expect(text).toContain("workspace-1");
  } finally {
    await browser.close();
    await fixture.close();
  }
}, 30_000);

test("Task fields drops a late lint result after the draft changes", async () => {
  const fixture = await projectsHost();
  const browser = await chromium.launch({ headless: true });
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.setDefaultTimeout(4000);
    await page.addInitScript(() => {
      const original = window.fetch;
      window.fetch = (input, init) =>
        original(
          input,
          typeof input === "string" && input.endsWith("/lint") ? { ...init, signal: null } : init,
        );
    });
    await page.goto(fixture.url + "/console/settings/task-fields");
    await page.getByRole("tab", { name: "YAML", exact: true }).click();
    await page.locator(".cm-content").waitFor();
    const original = await page.locator(".cm-content").innerText();
    let seen!: () => void;
    const received = new Promise<void>((resolve) => {
      seen = resolve;
    });
    let first = true;
    await page.route("**/api/declarations/lint", async (route) => {
      if (!first) {
        await route.continue();
        return;
      }
      first = false;
      const response = await route.fetch();
      const body = (await response.json()) as Record<string, unknown>;
      seen();
      await held;
      await route.fulfill({
        response,
        json: {
          ...body,
          findings: [
            {
              kind: "schema",
              location: "/projects/delivery/lifecycle",
              message: "Old field diagnostic",
              range: { from: 0, to: 1, line: 1, column: 1 },
            },
          ],
        },
      });
    });
    await page.locator(".cm-content").fill(original.replace("Delivered", "Collected"));
    await received;
    await page.locator(".cm-content").fill(original.replace("Delivered", "Posted"));
    await page.waitForFunction(
      () =>
        !Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
          (button) => button.textContent === "Publish",
        )?.disabled,
    );
    const lateResponse = page.waitForResponse("**/api/declarations/lint");
    release();
    await lateResponse;
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    expect(await page.getByText("Old field diagnostic").count()).toBe(0);
    expect(await page.getByRole("button", { name: "Publish", exact: true }).isDisabled()).toBe(
      false,
    );
    expect(await page.locator(".cm-content").innerText()).toContain("Posted");
  } finally {
    release();
    await browser.close();
    await fixture.close();
  }
}, 30_000);

test("Task fields keeps a pending save through reload and retries without another commit", async () => {
  const fixture = await projectsHost();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.setDefaultTimeout(4000);
    await page.goto(fixture.url + "/console/settings/task-fields");
    await page.getByRole("tab", { name: "YAML", exact: true }).click();
    await page.locator(".cm-content").waitFor();
    const original = await page.locator(".cm-content").innerText();
    await page.locator(".cm-content").fill(original.replace("Delivered", "Collected"));
    await page.waitForFunction(
      () =>
        !Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
          (button) => button.textContent === "Publish",
        )?.disabled,
    );
    fixture.deferNextSave();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByLabel("Commit message").fill("Adjust pending parcel stage");
    await page.getByRole("button", { name: "Commit and push", exact: true }).click();
    await page.getByRole("button", { name: "Load saved version", exact: true }).waitFor();
    await page.reload();
    await page.getByRole("button", { name: "Load saved version", exact: true }).waitFor();
    await page.getByRole("tab", { name: "YAML", exact: true }).click();
    await page.locator(".cm-content").waitFor();
    expect(await page.locator(".cm-content").innerText()).toContain("Collected");
    expect(await page.locator(".cm-content").getAttribute("contenteditable")).toBe("false");
    await capture(page, "task-fields-pending-save");
    const remoteCommit = await fixture.remoteHead();
    await page.getByRole("button", { name: "Load saved version", exact: true }).click();
    await page.getByRole("button", { name: "Publish", exact: true }).waitFor();
    expect(await page.getByRole("button", { name: "Publish", exact: true }).isDisabled()).toBe(
      true,
    );
    expect(fixture.saveAttempts()).toBe(2);
    expect(await fixture.remoteHead()).toBe(remoteCommit);
    expect(
      await page.evaluate(() =>
        localStorage.getItem("manifold.declaration-draft.task-metadata.yml"),
      ),
    ).toBeNull();
  } finally {
    await browser.close();
    await fixture.close();
  }
}, 30_000);

test("Task fields conflict comparison and latest base preserve the operator draft", async () => {
  const fixture = await projectsHost();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.setDefaultTimeout(4000);
    await page.goto(fixture.url + "/console/settings/task-fields");
    await page.getByRole("tab", { name: "YAML", exact: true }).click();
    await page.locator(".cm-content").waitFor();
    const original = await page.locator(".cm-content").innerText();
    await page.locator(".cm-content").fill(original.replace("Delivered", "Collected"));
    await fixture.changeTaskMetadata(original.replace("Delivered", "Posted"));
    await page.waitForFunction(
      () =>
        !Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
          (button) => button.textContent === "Publish",
        )?.disabled,
    );
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("button", { name: "Commit and push", exact: true }).click();
    await page.getByRole("button", { name: "Use latest as base", exact: true }).waitFor();
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    await page.locator(".cm-merge-a .cm-content").waitFor();
    expect(await page.locator(".cm-merge-a .cm-content").innerText()).toContain("Posted");
    expect(await page.getByRole("dialog").locator(".cm-merge-b .cm-content").innerText()).toContain(
      "Collected",
    );
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Use latest as base", exact: true }).click();
    expect(await page.locator(".cm-content").innerText()).toContain("Collected");
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("button", { name: "Commit and push", exact: true }).click();
    await page
      .getByRole("status")
      .filter({ hasText: /^Saved as [0-9a-f]{7}$/ })
      .waitFor();
    const source = await fixture.service.processRepository.current()!.read("task-metadata.yml");
    expect(source).toContain("Collected");
    expect(source).not.toContain("Posted");
  } finally {
    await browser.close();
    await fixture.close();
  }
}, 30_000);
