// ---
// relationships:
//   verifies: [retention, operator-console]
// ---
import { chromium } from "playwright";
import { expect, test } from "vite-plus/test";
import { mountConsole } from "../console/index.ts";
import { consoleHost } from "../console/test-fixtures/host.ts";
import { actorWorld } from "../console/test-fixtures/actor-world.ts";
test("a pruned actor keeps its timeline and usage and shows why its sequence is empty", async () => {
  const f = await actorWorld(),
    server = await consoleHost(),
    browser = await chromium.launch({ headless: true });
  try {
    const ended = f.store.endedSnapshots().find((s) => s.actorId === "task:parcel")!;
    const before = f.usage.actorUsage(ended.actorId);
    f.store.connection.transaction(() => {
      f.store.pruneEnded(ended.actorId);
      f.history.prune(ended.actorId);
    });
    expect(f.history.read(ended.actorId)?.prunedAt).toBeDefined();
    expect(f.usage.actorUsage(ended.actorId)).toEqual(before);
    mountConsole(server.host, { store: f.store, history: f.history });
    server.host.mount("/api/tasks", f.tasks.requestListener);
    server.host.mount("/api/usage", f.usage.listener);
    const page = await browser.newPage(),
      errors: string[] = [];
    page.setDefaultTimeout(3000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${server.url}/console/actors/${encodeURIComponent(ended.actorId)}`);
    await page.getByText(/Retention removed this actor's events and commands on/).waitFor();
    expect(await page.locator(".actor-timeline-table tbody tr").count()).toBe(4);
    expect(await page.locator(".actor-tiles").getByText("15", { exact: true }).count()).toBe(1);
    await page.getByRole("button", { name: "Sequence", exact: true }).click();
    await page.getByText("Events removed", { exact: true }).waitFor();
    expect(await page.locator(".actor-sequence").count()).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await server.close();
    await f.close();
  }
});
