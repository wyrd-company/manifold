// ---
// relationships:
//   verifies: [operator-console, actor-usage-api]
// ---
import { chromium } from "playwright";
import { expect, test } from "vite-plus/test";
import { mountConsole } from "./index.ts";
import { consoleHost } from "./test-fixtures/host.ts";
import { actorWorld } from "./test-fixtures/actor-world.ts";
test("built Actors shows active and completed histories, usage, sequence and the Task timeline", async () => {
  const f = await actorWorld(),
    server = await consoleHost(),
    browser = await chromium.launch({ headless: true });
  try {
    const project = {
      implementation: "t3code-project-create" as const,
      commandId: "project-command",
      invocation: { actorId: "task:parcel", invokeId: "create", entryId: "one" },
      environment: "sample-host",
      projectId: "project-one",
    };
    f.history.commandSending(project);
    f.history.commandAccepted({ ...project, sequence: 1 });
    mountConsole(
      {
        ...server.host,
        mount: (prefix, listener) =>
          server.host.mount(prefix, prefix === "/api/actors" ? f.historyListener : listener),
      },
      { store: f.store, history: f.history },
    );
    server.host.mount("/api/tasks", f.tasks.requestListener);
    server.host.mount("/api/usage", f.usage.listener);
    const page = await browser.newPage(),
      errors: string[] = [];
    page.setDefaultTimeout(3000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(server.url + "/console/actors");
    await page.getByText("1 active actors", { exact: true }).waitFor();
    await page.getByRole("img", { name: "Actor timeline" }).waitFor();
    await page.getByText("15 tokens", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Completed", exact: true }).click();
    await page.getByText("1 completed actors", { exact: true }).waitFor();
    await page.reload();
    await page.getByText("1 completed actors", { exact: true }).waitFor();
    await page.getByLabel("Portfolio item", { exact: true }).selectOption("deliveries");
    await page.getByLabel("Environment", { exact: true }).selectOption("sample-host");
    await page.getByRole("link", { name: "example/delivery#2", exact: true }).click();
    await page.getByRole("heading", { name: /Deliver parcel/ }).waitFor();
    await page.locator(".actor-page-header").getByText("Completed", { exact: true }).waitFor();
    expect(
      await page
        .getByRole("navigation", { name: "Main" })
        .getByRole("link", { name: "Actors", exact: true })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(await page.locator(".actor-timeline-table tbody tr").count()).toBe(4);
    await page.getByText("handoff", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Sequence", exact: true }).click();
    await page.getByText("Manifold", { exact: true }).last().waitFor();
    await page.getByText("Start thread", { exact: false }).waitFor();
    await page.getByText("Create project", { exact: true }).waitFor();
    await page.getByText("T3 Code project · project-", { exact: true }).waitFor();
    await page.getByText("Move to Delivered · confirmed", { exact: true }).waitFor();
    expect(await page.locator(".actor-message-usage").allTextContents()).toContain(
      "15 tokenssample · <$0.0001",
    );
    await page.reload();
    await page.getByText("Move to Delivered · confirmed", { exact: true }).waitFor();
    await page.getByRole("link", { name: "← All actors" }).click();
    await page.getByRole("link", { name: "example/delivery#1", exact: true }).click();
    await page.locator(".actor-page-header").getByText("Running", { exact: true }).waitFor();
    expect(
      await page.getByRole("link", { name: "Open thread", exact: true }).getAttribute("href"),
    ).toBe("https://example.test/environment/thread-2");
    await page.getByRole("button", { name: "Sequence", exact: true }).click();
    await page.getByText("running", { exact: false }).last().waitFor();
    await page.goto(server.url + "/console/actors?item=missing");
    await page.getByText("No actors match these filters", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await page.getByText("1 active actors", { exact: true }).waitFor();
    await page.goto(server.url + "/console/board/task/task%3Aparcel");
    await page
      .locator(".task-actor-timeline")
      .getByRole("img", { name: "Actor timeline" })
      .waitFor();
    expect(await page.locator(".actor-visit-durations small").count()).toBe(3);
    await page.getByRole("link", { name: "Open actor", exact: true }).click();
    await page.getByRole("heading", { name: /Deliver parcel/ }).waitFor();
    f.failHistory(true);
    await page.getByRole("button", { name: "Refresh actor" }).click();
    await page
      .getByRole("alert")
      .getByText("Cannot read actor history. Check the connection and try again.")
      .waitFor();
    expect(await page.locator(".actor-tiles").getByText("15", { exact: true }).count()).toBe(1);
    f.failHistory(false);
    await page.getByRole("button", { name: "Try again" }).click();
    await page.getByText("handoff", { exact: true }).waitFor();
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await server.close();
    await f.close();
  }
});
