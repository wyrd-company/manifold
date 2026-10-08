// ---
// relationships:
//   verifies: [operator-console, epics-api]
// ---
import { chromium } from "playwright";
import { expect, test } from "vite-plus/test";
import { epicWorld } from "./test-fixtures/world.ts";
import { openHistory } from "../history/index.ts";
import { mountConsole } from "../console/index.ts";
import { consoleHost } from "../console/test-fixtures/host.ts";
test("built Epics screen reads the mirror, focuses dependencies, and returns from a task with its selection", async () => {
  const f = epicWorld(),
    server = await consoleHost(),
    browser = await chromium.launch({ headless: true });
  try {
    mountConsole(server.host, {
      store: f.store,
      history: openHistory({ store: f.store, log: () => {} }),
    });
    server.host.mount("/api/tasks", f.tasks.requestListener);
    server.host.mount("/api/epics", f.epics.requestListener);
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(3000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(server.url + "/console/epics");
    await page.getByText("4 tasks · 1 done · 3 open", { exact: true }).waitFor();
    const node = (id: string) => page.locator(`.react-flow__node[data-id="${id}"] .epic-node`);
    await node("parcel").waitFor();
    await node("parcel").getByText("Escalated", { exact: true }).waitFor();
    await node("parcel").getByText("Ready · delivered", { exact: true }).waitFor();
    expect(await node("waiting").locator("[aria-label=Done]").count()).toBe(1);
    expect(
      await node("untracked").getByText("Not on a bound Project", { exact: true }).count(),
    ).toBe(1);
    expect(await node("outside").evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe(
      "dashed",
    );
    expect(await page.locator(".epic-critical").count()).toBe(3);
    await page.getByRole("switch", { name: "Critical path", exact: true }).uncheck();
    expect(await page.locator(".epic-critical").count()).toBe(0);
    expect(await node("waiting").evaluate((el) => getComputedStyle(el).opacity)).toBe("0.55");
    await page.getByRole("switch", { name: "Fade completed", exact: true }).uncheck();
    await expect
      .poll(() => node("waiting").evaluate((el) => getComputedStyle(el).opacity))
      .toBe("1");
    await page.reload();
    await node("parcel").waitFor();
    expect(await page.getByRole("switch", { name: "Critical path", exact: true }).isChecked()).toBe(
      false,
    );
    expect(
      await page.getByRole("switch", { name: "Fade completed", exact: true }).isChecked(),
    ).toBe(false);
    await node("branch").getByRole("button").hover();
    await expect
      .poll(() => node("waiting").evaluate((el) => getComputedStyle(el).opacity))
      .toBe("0.3");
    expect(await node("parcel").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    await node("parcel").getByRole("button").click();
    await page.getByRole("link", { name: "Open task", exact: true }).waitFor();
    await page.mouse.move(0, 0);
    await page.locator(".epic-selection").getByText("4 open", { exact: true }).waitFor();
    expect(await page.locator(".epic-selection").textContent()).toContain(
      "example/delivery#20 → example/delivery#11 → example/delivery#2 → example/delivery#31",
    );
    await page.getByRole("link", { name: "Open task", exact: true }).focus();
    await page.keyboard.press("Escape");
    expect(await page.getByRole("link", { name: "Open task", exact: true }).count()).toBe(0);
    await node("parcel").getByRole("button").click();
    await page.getByRole("link", { name: "Open task", exact: true }).click();
    await page.getByRole("heading", { name: "Deliver parcel", exact: true }).waitFor();
    expect(
      await page.locator(".breadcrumb").getByRole("link", { name: "Epics", exact: true }).count(),
    ).toBe(1);
    expect(
      await page
        .getByRole("navigation", { name: "Main" })
        .getByRole("link", { name: "Epics", exact: true })
        .getAttribute("aria-current"),
    ).toBe("page");
    await page.getByRole("link", { name: "← Epics", exact: true }).click();
    await node("parcel").waitFor();
    expect(await node("parcel").getByRole("button").getAttribute("aria-pressed")).toBe("true");
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await node("branch").getByRole("button").focus();
    await node("branch").getByRole("button").hover();
    await page.mouse.move(0, 0);
    await expect
      .poll(() => node("waiting").evaluate((el) => getComputedStyle(el).opacity))
      .toBe("0.3");
    await page.keyboard.press("Enter");
    expect(await node("branch").getByRole("button").getAttribute("aria-pressed")).toBe("true");
    await page.keyboard.press("Escape");
    expect(await node("branch").getByRole("button").getAttribute("aria-pressed")).toBe("false");
    await page.getByLabel("Root task", { exact: true }).selectOption("outside");
    await node("other").waitFor();
    expect(await node("parcel").count()).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await server.close();
    await f.close();
  }
});

test("Epics handles subtree links, missing roots, no sub-issues, cycle warnings, and read failures", async () => {
  const f = epicWorld(),
    server = await consoleHost(),
    browser = await chromium.launch({ headless: true });
  try {
    mountConsole(server.host, {
      store: f.store,
      history: openHistory({ store: f.store, log: () => {} }),
    });
    server.host.mount("/api/tasks", f.tasks.requestListener);
    server.host.mount("/api/epics", f.epics.requestListener);
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(3000);
    await page.goto(server.url + "/console/epics?root=branch&selected=untracked");
    await page.getByText("1 tasks · 0 done · 1 open", { exact: true }).waitFor();
    expect(await page.getByLabel("Root task", { exact: true }).inputValue()).toBe("branch");
    expect(await page.getByRole("button", { name: "Clear", exact: true }).count()).toBe(0);
    await page.goto(server.url + "/console/epics?root=waiting");
    await page.getByText("No sub-issues", { exact: true }).waitFor();
    await page.goto(server.url + "/console/epics?root=unknown");
    await page.getByText("Root task not found", { exact: true }).waitFor();
    const before = f.mirror.read(),
      after = f.mirror.read();
    after.dependencies.set("outside:parcel", {
      from: "outside",
      to: "parcel",
      present: true,
      revision: 0,
    });
    f.mirror.write(before, after);
    await page.goto(server.url + "/console/epics?root=root");
    await page
      .getByText("3 dependencies on GitHub form a cycle. The critical path leaves them out.", {
        exact: true,
      })
      .waitFor();
    await page.locator(".epic-cyclic").first().waitFor();
    expect(await page.locator(".epic-cyclic.epic-critical").count()).toBe(0);
    await page.locator('.react-flow__node[data-id="untracked"] button').click();
    expect(
      await page.getByRole("link", { name: "Open on GitHub", exact: true }).getAttribute("href"),
    ).toBe("https://example.test/issues/12");
    await page.route("**/api/epics", (route) => route.fulfill({ status: 500 }));
    await page.getByRole("button", { name: "Refresh epics", exact: true }).click();
    await page
      .getByRole("alert")
      .getByText("Cannot read epics. Check the connection and try again.", { exact: true })
      .waitFor();
    await page.unroute("**/api/epics");
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await page.getByLabel("Root task", { exact: true }).waitFor();
    const current = f.mirror.read(),
      empty = f.mirror.read();
    for (const [id, row] of empty.subIssues) empty.subIssues.set(id, { ...row, present: false });
    f.mirror.write(current, empty);
    await page.goto(server.url + "/console/epics");
    await page.getByText("No epics", { exact: true }).waitFor();
  } finally {
    await browser.close();
    await server.close();
    await f.close();
  }
});
