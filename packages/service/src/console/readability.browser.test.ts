// ---
// relationships:
//   verifies: operator-console
// ---
import { chromium } from "playwright";
import { expect, test } from "vite-plus/test";
import { serviceFixture } from "../service/test-fixtures/repository.ts";
import { startService } from "../service/index.ts";

const collection = "collection_with_a_long_name_for_the_selected_state_path";
const inner = "another_collection_with_a_long_name";
const first = `${collection}.${inner}.first`;

test("nested canvas edges meet nodes and long selections stay inside the inspector in both themes", async () => {
  const fixture = await serviceFixture();
  await fixture.commit(
    60,
    {},
    {
      machine: {
        id: "sample",
        initial: collection,
        states: {
          [collection]: {
            initial: inner,
            states: {
              [inner]: {
                initial: "first",
                states: {
                  first: { on: { NEXT: "second", FINISH: "#sample.complete", AGAIN: "first" } },
                  second: { type: "final" },
                },
              },
            },
          },
          complete: { type: "final" },
        },
      },
      schemas: {
        input: true,
        output: true,
        context: true,
        events: { NEXT: true, FINISH: true, AGAIN: true },
      },
    },
  );
  const service = await startService({ configurationFile: fixture.file, log: () => {} });
  const browser = await chromium.launch({ headless: true });
  try {
    const address = service.http.address();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(
      `http://${address.host}:${address.port}/console/blueprints/blueprints/counter.yml`,
    );
    await page.locator(`.react-flow__node[data-id="${first}"]`).waitFor();
    await page
      .locator('[data-testid="rf__edge-edge-0"] path')
      .first()
      .waitFor({ state: "attached" });
    const endpoints = await page.evaluate(() => {
      const pairs = [
        [
          "edge-0",
          "collection_with_a_long_name_for_the_selected_state_path.another_collection_with_a_long_name.first",
          "collection_with_a_long_name_for_the_selected_state_path.another_collection_with_a_long_name.second",
        ],
        [
          "edge-1",
          "collection_with_a_long_name_for_the_selected_state_path.another_collection_with_a_long_name.first",
          "complete",
        ],
        [
          "edge-2",
          "collection_with_a_long_name_for_the_selected_state_path.another_collection_with_a_long_name.first",
          "collection_with_a_long_name_for_the_selected_state_path.another_collection_with_a_long_name.first",
        ],
      ];
      return pairs.flatMap(([id, source, target]) => {
        const path = document.querySelector<SVGPathElement>(`[data-testid="rf__edge-${id}"] path`)!;
        return [source, target].map((node, index) => {
          const point = path
            .getPointAtLength(index ? path.getTotalLength() : 0)
            .matrixTransform(path.getScreenCTM()!);
          const rect = document
            .querySelector(`.react-flow__node[data-id="${node}"]`)!
            .getBoundingClientRect();
          return {
            id,
            node,
            distance: Math.max(
              rect.left - point.x,
              point.x - rect.right,
              rect.top - point.y,
              point.y - rect.bottom,
              0,
            ),
          };
        });
      });
    });
    for (const endpoint of endpoints)
      expect(endpoint.distance, `${endpoint.id} meets ${endpoint.node}`).toBeLessThan(1);
    const next = page.getByText("NEXT", { exact: true });
    expect(
      await next.evaluate((label) => {
        const rect = label.getBoundingClientRect();
        return label.contains(
          document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
        );
      }),
      "nested edge label is above the group surface",
    ).toBe(true);
    await next.click();
    await expect.poll(() => page.locator(".inspector-path").textContent()).toContain("/on/NEXT");
    expect(
      await page
        .locator(".canvas-inspector")
        .evaluate((panel) => panel.scrollWidth - panel.clientWidth),
    ).toBeLessThanOrEqual(1);
    await page.locator(`.react-flow__node[data-id="${first}"]`).click();
    for (const theme of ["dark", "light"]) {
      await page.evaluate(
        (theme) => document.documentElement.classList.toggle("dark", theme === "dark"),
        theme,
      );
      const inspector = page.locator(".canvas-inspector");
      const bounds = await inspector.evaluate((panel) => {
        const path = panel.querySelector("p")!;
        const a = panel.getBoundingClientRect(),
          b = path.getBoundingClientRect();
        return {
          text: path.textContent,
          overflow: panel.scrollWidth - panel.clientWidth,
          left: b.left - a.left,
          right: a.right - b.right,
        };
      });
      expect(bounds.text).toBe(first);
      expect(bounds.overflow).toBeLessThanOrEqual(1);
      expect(bounds.left).toBeGreaterThanOrEqual(12);
      expect(bounds.right).toBeGreaterThanOrEqual(12);
    }
    await page.setViewportSize({ width: 800, height: 900 });
    expect(
      await page
        .locator(".canvas-inspector")
        .evaluate((panel) => panel.scrollWidth - panel.clientWidth),
    ).toBeLessThanOrEqual(1);
  } finally {
    await browser.close();
    await service.stop();
    await fixture.close();
  }
});

test("portfolio dialog has inset controls, separated fields and a distinct surface in both themes", async () => {
  const fixture = await serviceFixture();
  await fixture.commit(60, {
    accounts: {
      accounts: {
        acct: {
          unit: "usd",
          kind: "api",
          capacity: { amount: 10, reset: "2026-01-01T00:00:00Z", every: { months: 1 } },
        },
      },
    },
  });
  const service = await startService({ configurationFile: fixture.file, log: () => {} });
  const browser = await chromium.launch({ headless: true });
  try {
    const address = service.http.address();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`http://${address.host}:${address.port}/console/portfolio`);
    await page.getByRole("button", { name: "Edit alpha", exact: true }).click();
    const dialog = page.getByRole("dialog");
    for (const theme of ["dark", "light"]) {
      await page.evaluate(
        (theme) => document.documentElement.classList.toggle("dark", theme === "dark"),
        theme,
      );
      const spacing = await dialog.evaluate((popup) => {
        const rect = popup.getBoundingClientRect();
        const field = popup.querySelector('input[aria-label="Name"]')!.getBoundingClientRect();
        const fields = [...popup.querySelectorAll(".portfolio-number")].map((node) =>
          node.getBoundingClientRect(),
        );
        return {
          inset: Math.min(field.left - rect.left, rect.right - field.right),
          gap: Math.max(fields[1]!.left - fields[0]!.right, fields[1]!.top - fields[0]!.bottom),
          background: getComputedStyle(popup).backgroundColor,
          pageBackground: getComputedStyle(document.body).backgroundColor,
          overflow: popup.scrollWidth - popup.clientWidth,
        };
      });
      expect(spacing.inset).toBeGreaterThanOrEqual(20);
      expect(spacing.gap).toBeGreaterThanOrEqual(12);
      expect(spacing.background).not.toBe(spacing.pageBackground);
      expect(spacing.overflow).toBeLessThanOrEqual(1);
    }
    expect(
      await dialog.getByRole("button", { name: "Add sub-item", exact: true }).evaluate((button) => {
        const panel = button.closest("fieldset")!.getBoundingClientRect();
        const rect = button.getBoundingClientRect();
        return rect.bottom <= panel.bottom;
      }),
      "sub-item controls fit in the dialog without scrolling past unused space",
    ).toBe(true);
    await page.setViewportSize({ width: 540, height: 700 });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect.poll(() => page.getByRole("dialog").count()).toBe(0);
  } finally {
    await browser.close();
    await service.stop();
    await fixture.close();
  }
});
