// ---
// relationships:
//   verifies: [operator-console, actors-api]
// ---
import { chromium } from "playwright";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { openStore } from "../store/index.ts";
import { openHistory } from "../history/index.ts";
import { mountConsole } from "./index.ts";
import { consoleHost } from "./test-fixtures/host.ts";

test("built console serves the shell and live actors without authentication", async () => {
  const directory = mkdtempSync(join(tmpdir(), "console-browser-"));
  const store = openStore({ path: join(directory, "store.db") });
  const server = await consoleHost();
  const browser = await chromium.launch({ headless: true });
  try {
    store.saveSnapshot({
      actorId: "sample-a",
      machine: `${"b".repeat(40)}:blueprints/sample.yml`,
      snapshot: {
        status: "active",
        value: { working: { first: "ready", second: "waiting" } },
        context: {
          manifold: { environment: "sample-host", issue: "sample#1", portfolioItem: "sample-item" },
        },
      },
    });
    store.saveSnapshot({
      actorId: "sample-b",
      machine: "sample-machine",
      snapshot: { status: "active", value: "ready" },
    });
    mountConsole(server.host, { store, history: openHistory({ store, log: () => {} }) });
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(server.url + "/console/");
    await page.getByRole("heading", { name: "Overview", exact: true }).waitFor();
    for (const name of [
      "Overview",
      "Board",
      "Epics",
      "Actors",
      "Portfolio",
      "Blueprints",
      "GitHub Projects",
      "Environments",
      "Settings",
    ])
      expect(
        await page
          .getByRole("navigation", { name: "Main" })
          .getByRole("link", { name, exact: true })
          .count(),
      ).toBe(1);
    await page.getByRole("button", { name: "Theme: System" }).click();
    await page.getByRole("button", { name: "Theme: Light" }).click();
    expect(await page.locator("html").getAttribute("class")).toContain("dark");
    await page.reload();
    await page.getByRole("button", { name: "Theme: Dark" }).waitFor();
    expect(await page.locator("html").getAttribute("class")).toContain("dark");
    await page.getByRole("button", { name: "Toggle sidebar" }).click();
    await page.reload();
    expect(await page.locator("aside").getAttribute("data-collapsed")).toBe("true");
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Actors", exact: true })
      .click();
    await page.getByRole("cell", { name: "sample-host", exact: true }).waitFor();
    expect(
      await page.getByRole("cell", { name: "working.first.ready working.second.waiting" }).count(),
    ).toBe(1);
    expect(await page.getByRole("cell", { name: "sample-b", exact: true }).count()).toBe(1);
    expect(await page.getByRole("cell", { name: "blueprints/sample.yml bbbbbbb" }).count()).toBe(1);
    await page.reload();
    await page.getByRole("cell", { name: "sample-host", exact: true }).waitFor();
    store.saveSnapshot({
      actorId: "sample-b",
      machine: "sample-machine",
      snapshot: { status: "active", value: "changed" },
    });
    await page.getByRole("button", { name: "Refresh actors" }).click();
    await page.getByRole("cell", { name: "changed Running", exact: true }).waitFor();
    await page.getByRole("button", { name: "Search pages" }).click();
    await page.getByRole("dialog").getByLabel("Search pages").fill("Blueprints");
    await page.getByRole("dialog").getByLabel("Search pages").press("Enter");
    await page.getByRole("heading", { name: "Blueprints", exact: true }).waitFor();
    await page
      .getByRole("alert")
      .getByText("Cannot read blueprints. Check the connection and try again.")
      .waitFor();
    await page.goto(server.url + "/console/settings");
    await page.getByRole("heading", { name: "Task fields", exact: true }).waitFor();
    await page.getByRole("link", { name: "General", exact: true }).click();
    await page.getByRole("heading", { name: "General", exact: true }).waitFor();
    expect(await page.getByLabel("Operator token", { exact: true }).count()).toBe(0);
    expect(await page.getByText("Nothing here yet").count()).toBe(1);
    await page.goto(server.url + "/console/unknown");
    await page.getByRole("main").getByText("Page not found").waitFor();
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await server.close();
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
