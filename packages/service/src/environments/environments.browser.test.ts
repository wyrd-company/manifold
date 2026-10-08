// ---
// relationships:
//   verifies: [operator-console, environments-api, environment-control]
// ---
import { chromium } from "playwright";
import { expect, test } from "vite-plus/test";
import { readFile, writeFile } from "node:fs/promises";
import { parse, stringify } from "yaml";
import { environmentFixture } from "./test-fixtures/setup.ts";
import { startService } from "../service/index.ts";
test("built Environments shows two servers and applies independent pause and connection actions", async () => {
  const f = await environmentFixture();
  let service: Awaited<ReturnType<typeof startService>> | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    service = await startService({ configurationFile: f.file, log: () => {} });
    await Promise.all([service.t3code.ready("station"), service.t3code.ready("depot")]);
    const loaded = await service.blueprints.version({
      commit: f.commit,
      path: "blueprints/counter.yml",
    });
    if (loaded.status !== "loaded") throw new Error(JSON.stringify(loaded));
    service.actorHost.start({
      actorId: "parcel",
      blueprint: loaded.blueprint,
      input: { manifold: { environment: "station" } },
    });
    await expect.poll(() => service!.store.loadSnapshot("parcel")?.snapshot.value).toBe("waiting");
    const thread = [...f.servers[0]!.threads.values()][0]!;
    await service.agentThreads.startTurn({
      environment: "station",
      threadId: thread.id,
      messageId: "sample-message",
      text: "Process the parcel",
    });
    await expect.poll(() => service!.t3code.status()[0]?.activeThreads).toBe(1);
    const configurationBefore = await readFile(f.file, "utf8");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const { host, port } = service.http.address();
    await page.goto(`http://${host}:${port}/console/environments`);
    const station = page
      .getByRole("row")
      .filter({ has: page.getByRole("button", { name: "Pause station", exact: true }) });
    await station.getByText("Connected", { exact: true }).waitFor();
    const depot = page.getByRole("row").filter({ hasText: "depot" });
    await depot.getByText("Connected", { exact: true }).waitFor();
    expect(await station.locator("td").nth(2).textContent()).toBe("1");
    await page.getByText("2 environments · 2 connected · 0 paused", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Pause station", exact: true }).click();
    await page.getByRole("button", { name: "Resume station", exact: true }).waitFor();
    expect(service.environments.held("station").paused).toBe(true);
    const stableStation = page.getByRole("row").filter({ hasText: "station" });
    await stableStation.getByText("Paused", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Disconnect depot", exact: true }).click();
    await depot.getByText("Disconnected", { exact: true }).waitFor();
    expect(await depot.locator("td").nth(2).textContent()).toBe("—");
    await expect.poll(() => f.servers[1]!.sockets()).toBe(0);
    await page.reload();
    await stableStation.getByText("Paused", { exact: true }).waitFor();
    await depot.getByText("Disconnected", { exact: true }).waitFor();
    f.servers[0]!.settle(thread.id);
    await expect.poll(() => service!.t3code.status()[0]?.activeThreads).toBe(0);
    expect(
      service.store.connection.database
        .prepare(
          "SELECT payload FROM store_inbox WHERE actor_id=? AND json_extract(payload, '$.type')=?",
        )
        .all("parcel", "t3.turn.settled"),
    ).toHaveLength(1);
    await page.getByRole("button", { name: "Reconnect depot", exact: true }).click();
    await depot.getByText("Connected", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Resume station", exact: true }).click();
    await stableStation.getByText("Connected", { exact: true }).waitFor();
    await page.getByText(f.file, { exact: true }).waitFor();
    expect(await readFile(f.file, "utf8")).toBe(configurationBefore);
    expect(await page.getByRole("button", { name: /Add environment|Forget/ }).count()).toBe(0);
    await page.getByRole("button", { name: "Refresh Environments", exact: true }).click();
    await page.reload();
    await stableStation.getByText("Connected", { exact: true }).waitFor();
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      expect(
        await page
          .locator(".environments-table")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
    }
    expect(
      service.store.connection.database
        .prepare(
          "SELECT event_id FROM router_source_event WHERE source='environment' ORDER BY accepted_at,event_id",
        )
        .all()
        .map((row) => row["event_id"]),
    ).toEqual(["station/1", "depot/1", "depot/2", "station/2"]);
    f.servers[0]!.setToken("replacement-fixture-token");
    f.servers[0]!.failShell();
    await page.getByRole("button", { name: "Refresh Environments", exact: true }).click();
    await stableStation.getByText("Error", { exact: true }).waitFor();
    expect(errors).toEqual([]);
  } finally {
    await browser?.close();
    await service?.stop();
    await f.close();
  }
});

test("built Environments shows the error and unknown active count when one server is down", async () => {
  const f = await environmentFixture();
  let service: Awaited<ReturnType<typeof startService>> | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await f.servers[0]!.close();
    const configuration = parse(await readFile(f.file, "utf8"));
    configuration.environments.station.openTimeoutMs = 100;
    await writeFile(f.file, stringify(configuration));
    service = await startService({ configurationFile: f.file, log: () => {} });
    await service.t3code.ready("depot");
    await expect.poll(() => service!.t3code.status()[0]?.error).toBeTruthy();
    const { host, port } = service.http.address();
    const body = await (await fetch(`http://${host}:${port}/api/environments`)).json();
    expect(body.environments[0]).toMatchObject({
      name: "station",
      connection: "connecting",
      activeThreads: null,
    });
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`http://${host}:${port}/console/environments`);
    const station = page.getByRole("row").filter({ hasText: "station" });
    await station.getByText("Error", { exact: true }).waitFor();
    expect(await station.locator("td").nth(2).textContent()).toBe("—");
    await page
      .getByRole("row")
      .filter({ hasText: "depot" })
      .getByText("Connected", { exact: true })
      .waitFor();
  } finally {
    await browser?.close();
    await service?.stop();
    await f.close();
  }
});
