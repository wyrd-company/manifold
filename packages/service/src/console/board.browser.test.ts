// ---
// relationships:
//   verifies: [operator-console, tasks-api, escalation-contract]
// ---
import { chromium } from "playwright";
import { expect, test } from "vite-plus/test";
import { boardWorld } from "../tasks/test-fixtures/world.ts";
import { openHistory } from "../history/index.ts";
import { mountConsole } from "./index.ts";
import { mountEscalations } from "../escalations/index.ts";
import { consoleHost } from "./test-fixtures/host.ts";
test("built Board reads settled usage and records panel answers once, including a competing channel", async () => {
  const f = boardWorld(true),
    server = await consoleHost(),
    browser = await chromium.launch({ headless: true });
  try {
    mountConsole(server.host, {
      store: f.store,
      history: openHistory({ store: f.store, log: () => {} }),
    });
    server.host.mount("/api/tasks", f.tasks.requestListener);
    mountEscalations(server.host, f.module);
    const page = await browser.newPage();
    page.setDefaultTimeout(3000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(server.url + "/console/board");
    await page.getByRole("heading", { name: "Ready", exact: true }).waitFor();
    await page.getByRole("heading", { name: "Delivered", exact: true }).waitFor();
    await page.getByRole("link", { name: /Collect parcel/ }).waitFor();
    expect(await page.getByText("Archived parcel").count()).toBe(0);
    await page.getByRole("button", { name: "Collapse Delivered" }).click();
    await page.reload();
    await page.getByRole("button", { name: "Expand Delivered" }).waitFor();
    await page.getByRole("link", { name: /Deliver parcel/ }).click();
    await page.getByRole("heading", { name: "Deliver parcel", exact: true }).waitFor();
    expect(
      await page
        .getByRole("navigation", { name: "Main" })
        .getByRole("link", { name: "Board", exact: true })
        .getAttribute("aria-current"),
    ).toBe("page");
    await page.getByText("blueprints/delivery.yml · bbbbbbb", { exact: true }).waitFor();
    expect(
      await page.getByRole("link", { name: "Open thread", exact: true }).getAttribute("href"),
    ).toBe("https://example.test/environment/thread-1");
    const usage = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Usage", exact: true }) });
    await usage.getByText("Settled", { exact: true }).waitFor();
    expect(await usage.getByRole("row").allTextContents()).toEqual([
      "AccountEstimateActualVarianceReserved",
      "sample$1.00$0.0177−$0.9823$0.00",
      "second$1.00$0.0177−$0.9823$0.00",
    ]);
    await page.getByRole("button", { name: "Leave at door", exact: true }).click();
    await page.getByText("Answered: Leave at door", { exact: true }).waitFor();
    expect(f.module.get(f.escalation.id)?.answer?.value).toEqual({ choice: "door" });
    expect(f.module.get(f.escalation.id)?.answer?.channel).toBe("api");
    expect(f.module.answer(f.escalation.id, { choice: "desk" }, "link").status).toBe("closed");
    await page.getByRole("button", { name: "Refresh task" }).click();
    await page.locator(".recent-escalation").getByText("Leave at door", { exact: false }).waitFor();
    const second = f.ask();
    await page.getByRole("button", { name: "Refresh task" }).click();
    await page.getByRole("button", { name: "Leave at door", exact: true }).waitFor();
    const response = await fetch(`${server.url}/api/escalations/${second.id}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Use the side entrance" }),
    });
    expect(response.status).toBe(200);
    await page.getByRole("button", { name: "Leave at door", exact: true }).click();
    await page
      .getByText("Already answered: Use the side entrance (api)", { exact: true })
      .waitFor();
    expect(f.module.get(second.id)?.answer?.value).toEqual({ text: "Use the side entrance" });
    expect(f.module.list({ status: "answered" })).toHaveLength(2);
    await page.reload();
    await page
      .locator(".recent-escalation")
      .getByText("Use the side entrance", { exact: false })
      .waitFor();
    await page.getByRole("link", { name: "← Board" }).click();
    await page.getByRole("heading", { name: "Ready", exact: true }).waitFor();
    await page.getByLabel("Project", { exact: true }).selectOption("example/2");
    await page.getByText("This Project declares no lifecycle field.").waitFor();
    await page.reload();
    await page.getByText("This Project declares no lifecycle field.").waitFor();
    await page.goto(server.url + "/console/board/task/task%3Aparcel");
    const third = f.ask();
    await page.getByRole("button", { name: "Refresh task" }).click();
    await page.getByLabel("Answer Delivery question").fill("Use the lobby");
    await page.getByRole("button", { name: "Answer", exact: true }).click();
    await page.getByText("Answered: Use the lobby", { exact: true }).waitFor();
    expect(f.module.get(third.id)?.answer?.value).toEqual({ text: "Use the lobby" });
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await server.close();
    await f.close();
  }
});
