// ---
// relationships:
//   verifies: [operator-console, blueprints-api]
// ---
import { chromium } from "playwright";
import { parse } from "yaml";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import git from "isomorphic-git";
import { expect, test } from "vite-plus/test";
import { serviceFixture } from "../service/test-fixtures/repository.ts";
import { startService } from "../service/index.ts";
test("canvas edits, dragged transition, expression findings, YAML toggle, layout and publish share one draft", async () => {
  const fixture = await serviceFixture();
  await git.setConfig({ fs, gitdir: fixture.remote.gitdir, path: "http.receivepack", value: true });
  await fixture.commit(
    60,
    {},
    {
      machine: {
        id: "sample",
        initial: "waiting",
        states: { waiting: {}, complete: { type: "final" } },
      },
      schemas: { input: true, output: true, context: true, events: { NEXT: true } },
    },
  );
  const service = await startService({ configurationFile: fixture.file, log: () => {} });
  const browser = await chromium.launch({ headless: true });
  try {
    const address = service.http.address();
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors: string[] = [];

    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(
      `http://${address.host}:${address.port}/console/blueprints/blueprints/counter.yml`,
    );
    await page.locator(".canvas-state").getByText("waiting", { exact: true }).waitFor();
    expect(await page.locator(".blueprint-source").count()).toBe(0);

    await page.getByLabel("Add state", { exact: true }).selectOption("atomic");
    const surface = await page.locator(".canvas-surface").boundingBox();
    await page.mouse.move(surface!.x + surface!.width - 100, surface!.y + surface!.height - 100);
    await expect.poll(() => page.locator(".canvas-placement-ghost").count()).toBe(1);
    await page.mouse.click(surface!.x + surface!.width - 100, surface!.y + surface!.height - 100);
    await page.locator(".canvas-state").getByText("state", { exact: true }).waitFor();

    await page.getByRole("button", { name: "Fit", exact: true }).click();
    const source = page.locator('.react-flow__node[data-id="waiting"]');
    const target = page.locator('.react-flow__node[data-id="state"]');
    await source.click();
    await page
      .locator(".canvas-inspector")
      .getByRole("button", { name: "Add transition", exact: true })
      .click();
    await page.locator(".canvas-event-picker").waitFor();
    await page
      .locator(".canvas-event-picker")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await source.hover();
    const handle = await source.locator(".react-flow__handle-bottom").boundingBox();
    const end = await target.boundingBox();
    await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
    await page.mouse.down();
    await page.mouse.move(end!.x + end!.width / 2, end!.y + end!.height / 2, { steps: 12 });
    await page.mouse.up();

    await page.getByLabel("New event", { exact: true }).fill("NEXT");
    await page
      .locator(".canvas-event-picker")
      .getByRole("button", { name: "Add transition", exact: true })
      .click();

    await page.getByLabel("Guard kind").selectOption("expression");

    await page.getByLabel("Expression", { exact: true }).fill("(");

    await page.waitForFunction(
      () =>
        Number(
          document.querySelector(".blueprint-problems .error-text")?.textContent?.match(/\d+/)?.[0],
        ) > 0,
    );
    expect(await page.getByRole("button", { name: "Publish", exact: true }).isDisabled()).toBe(
      true,
    );
    expect(await page.locator(".canvas-edge-label.error").count()).toBeGreaterThan(0);
    await page.getByLabel("Expression", { exact: true }).fill("true");
    await page.waitForFunction(
      () =>
        !document.querySelector<HTMLButtonElement>(".blueprint-header-actions button:last-child")
          ?.disabled,
    );
    const screenshots = join(tmpdir(), "manifold-canvas-evidence");
    await fs.mkdir(screenshots, { recursive: true });
    await page.screenshot({ path: join(screenshots, "canvas-transition.png"), fullPage: true });
    await page.getByRole("button", { name: "YAML", exact: true }).click();
    expect(await page.locator(".blueprint-source .cm-content").innerText()).toContain("NEXT");
    expect(
      parse(await page.locator(".blueprint-source .cm-content").innerText()).machine.states.waiting
        .on.NEXT.guard.params.expression,
    ).toBe("true");
    await page.getByRole("button", { name: "Canvas", exact: true }).click();

    await page.getByRole("button", { name: "Fit", exact: true }).click();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    const node = page.locator('.react-flow__node[data-id="state"]');
    const bounds = await node.boundingBox();
    await page.mouse.move(bounds!.x + 40, bounds!.y + 20);
    await page.mouse.down();
    await page.mouse.move(bounds!.x + 100, bounds!.y + 80, { steps: 10 });
    await page.mouse.up();

    await page.waitForFunction(
      () => !document.querySelector<HTMLButtonElement>('[aria-label="Automatic layout"]')?.disabled,
    );

    await page.getByRole("button", { name: "Automatic layout", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector<HTMLButtonElement>('[aria-label="Automatic layout"]')?.disabled,
    );
    await page.waitForFunction(
      () =>
        !document.querySelector<HTMLButtonElement>(".blueprint-header-actions button:last-child")
          ?.disabled,
    );

    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByLabel("Commit message").fill("Edit sample flow");
    await page.getByRole("button", { name: "Commit and push", exact: true }).click();
    await page
      .getByRole("status")
      .filter({ hasText: /^Saved as [0-9a-f]{7}$/ })
      .waitFor();
    const commits = await git.log({ fs, gitdir: fixture.remote.gitdir, ref: "main" });
    expect(commits[0]?.commit.message).toContain("Edit sample flow");
    await page.screenshot({ path: join(screenshots, "canvas-published.png"), fullPage: true });
    await page.getByRole("link", { name: "Blueprints", exact: true }).first().click();
    await page
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: "blueprints/counter.yml", exact: true }) })
      .getByRole("cell", { name: commits[0]!.oid.slice(0, 7), exact: true })
      .waitFor();
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await service.stop();
    await fixture.close();
  }
}, 30000);
