// ---
// relationships:
//   verifies: operator-console
// ---
import { chromium, type Locator, type Page } from "playwright";
import { expect, test } from "vite-plus/test";
import { serviceFixture } from "../service/test-fixtures/repository.ts";
import { startService } from "../service/index.ts";

const collection = "collection_with_a_long_name_for_the_selected_state_path";
const inner = "another_collection_with_a_long_name";
const first = `${collection}.${inner}.first`;

const dragBy = async (
  page: Page,
  target: Locator,
  delta: { x: number; y: number },
  button: "left" | "middle" | "right" = "left",
) => {
  const box = await target.boundingBox();
  if (!box) throw new Error("Drag target has no bounding box");
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down({ button });
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 5 });
  await page.mouse.up({ button });
};

const blankCanvasPoint = (pane: Locator) =>
  pane.evaluate((element) => {
    const box = element.getBoundingClientRect();
    for (let y = box.bottom - 24; y > box.top + 64; y -= 32)
      for (let x = box.left + 24; x < box.right - 24; x += 32)
        if (document.elementFromPoint(x, y) === element) return { x, y };
    throw new Error("Canvas has no blank pane point");
  });

const dragFrom = async (
  page: Page,
  start: { x: number; y: number },
  delta: { x: number; y: number },
  button: "left" | "middle" | "right" = "left",
) => {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down({ button });
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 5 });
  await page.mouse.up({ button });
};

const canvasState = (page: Page, node: string) =>
  page.evaluate((node) => {
    const selected = document.querySelector<HTMLElement>(".react-flow__node.selected");
    return {
      viewport: document.querySelector<HTMLElement>(".react-flow__viewport")!.style.transform,
      node: document.querySelector<HTMLElement>(`.react-flow__node[data-id="${node}"]`)!.style
        .transform,
      selected: selected?.dataset["id"],
      inspected: document.querySelector<HTMLElement>(".inspector-path")?.textContent,
      draft: localStorage.getItem("manifold.blueprint-draft.blueprints/counter.yml"),
    };
  }, node);

const colorChannels = (color: string) => {
  const channels = color
    .match(/[\d.]+/g)
    ?.slice(0, 3)
    .map(Number);
  if (!channels || channels.length !== 3) throw new Error(`Cannot parse color ${color}`);
  return channels;
};

const luminance = (color: string) => {
  const [red, green, blue] = colorChannels(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrast = (firstColor: string, secondColor: string) => {
  const [lighter, darker] = [luminance(firstColor), luminance(secondColor)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
};

const expectContrast = (
  pair: { foreground: string; background: string; label: string },
  minimum: number,
) => {
  expect
    .soft(contrast(pair.foreground, pair.background), pair.label)
    .toBeGreaterThanOrEqual(minimum);
};

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
    await page.locator('.canvas-toolbar button[aria-label="Add transition"]').click();
    await page.locator(`.react-flow__node[data-id="${first}"]`).click();
    await page.locator(`.react-flow__node[data-id="${collection}.${inner}.second"]`).click();
    await page.locator(".canvas-event-picker").waitFor();
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

      const colors = await page.evaluate(() => {
        const probe = document.createElement("span");
        document.body.append(probe);
        const resolve = (property: "color" | "backgroundColor", token: string) => {
          probe.style[property] = `var(--${token})`;
          return getComputedStyle(probe)[property];
        };
        const surfaces = ["background", "card", "popover", "lane", "tile"].map((token) => ({
          token,
          color: resolve("backgroundColor", token),
        }));
        const text = [
          "foreground",
          "muted-foreground",
          "success-foreground",
          "warning-foreground",
          "error-foreground",
          "info-foreground",
        ].flatMap((foreground) =>
          surfaces.map((surface) => ({
            foreground: resolve("color", foreground),
            background: surface.color,
            label: `${foreground} on ${surface.token}`,
          })),
        );
        probe.remove();

        return {
          text,
          controls: [
            document.querySelector<HTMLInputElement>(
              '.canvas-inspector input:not([type="checkbox"])',
            )!,
            document.querySelector<HTMLSelectElement>(".canvas-event-picker select")!,
          ].map((control) => {
            const style = getComputedStyle(control);
            return {
              foreground: style.borderTopColor,
              background: style.backgroundColor,
              label: `${control.closest(".canvas-inspector") ? "inspector" : "event picker"} border`,
              focused: control === document.activeElement,
            };
          }),
        };
      });
      for (const pair of colors.text) expectContrast(pair, 4.5);
      for (const pair of colors.controls) {
        expect(pair.focused, `${pair.label} is unfocused`).toBe(false);
        expectContrast(pair, 3);
      }
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

      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      const contrasts = await dialog.evaluate((popup) => {
        const controls = [
          ...popup.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select"),
        ]
          .filter((control) => control.type !== "checkbox")
          .map((control) => {
            const style = getComputedStyle(control);
            return {
              foreground: style.borderTopColor,
              background: style.backgroundColor,
              label: `portfolio ${control.tagName.toLowerCase()} border`,
              focused: control === document.activeElement,
            };
          });
        const primary = [...popup.querySelectorAll<HTMLButtonElement>("button")].find(
          (button) => button.textContent?.trim() === "Save",
        )!;
        const style = getComputedStyle(primary);
        return {
          controls,
          primary: {
            foreground: style.color,
            background: style.backgroundColor,
            label: "primary button text",
          },
        };
      });
      expect(contrasts.controls.length).toBeGreaterThan(0);
      for (const pair of contrasts.controls) {
        expect(pair.focused, `${pair.label} is unfocused`).toBe(false);
        expectContrast(pair, 3);
      }
      expectContrast(contrasts.primary, 4.5);
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

test("Pan moves only the viewport and Select owns canvas selection and object movement", async () => {
  const fixture = await serviceFixture();
  await fixture.commit(
    60,
    {},
    {
      machine: {
        id: "sample",
        initial: "first",
        states: {
          first: { on: { NEXT: "second" } },
          second: { type: "final" },
        },
      },
      schemas: { input: true, output: true, context: true, events: { NEXT: true } },
      layout: { states: { first: { x: 80, y: 120 }, second: { x: 360, y: 120 } } },
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
    const pane = page.locator(".react-flow__pane");
    const firstNode = page.locator('.react-flow__node[data-id="first"]');
    const secondNode = page.locator('.react-flow__node[data-id="second"]');
    const label = page.getByRole("button", { name: "NEXT", exact: true });
    const toolbar = page.getByRole("toolbar", { name: "Canvas tools" });
    await firstNode.waitFor();
    await firstNode.click();

    const panButton = toolbar.locator("button").nth(1);
    expect.soft(await panButton.getAttribute("aria-label"), "viewport tool name").toBe("Pan");
    await panButton.click();

    const beforeNodePan = await canvasState(page, "first");
    await dragBy(page, firstNode, { x: 72, y: 48 });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));
    const afterNodePan = await canvasState(page, "first");
    expect(afterNodePan.viewport, "Pan drag over a node moves the viewport").not.toBe(
      beforeNodePan.viewport,
    );
    expect(afterNodePan.node, "Pan drag keeps graph position").toBe(beforeNodePan.node);
    expect(afterNodePan.draft, "Pan drag keeps pinned YAML").toBe(beforeNodePan.draft);
    expect(afterNodePan.inspected, "Pan drag keeps selection").toBe("first");

    const beforeLabelPan = await canvasState(page, "first");
    await dragBy(page, label, { x: 56, y: 32 });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));
    const afterLabelPan = await canvasState(page, "first");
    expect(afterLabelPan.viewport, "Pan drag over a transition label moves the viewport").not.toBe(
      beforeLabelPan.viewport,
    );
    expect(afterLabelPan.inspected, "Pan label drag keeps selection").toBe("first");

    await label.click();
    expect((await canvasState(page, "first")).inspected, "Pan label click keeps selection").toBe(
      "first",
    );

    const blank = await blankCanvasPoint(pane);
    await page.mouse.click(blank.x, blank.y);
    expect((await canvasState(page, "first")).inspected, "Pan pane click keeps selection").toBe(
      "first",
    );

    await toolbar.getByRole("button", { name: "Select", exact: true }).click();
    const beforeSelectionDrag = await canvasState(page, "first");
    await dragFrom(page, await blankCanvasPoint(pane), { x: 144, y: -112 });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));
    expect((await canvasState(page, "first")).viewport, "Select blank drag does not pan").toBe(
      beforeSelectionDrag.viewport,
    );

    const beforeMiddlePan = await canvasState(page, "first");
    await dragFrom(page, await blankCanvasPoint(pane), { x: 44, y: 28 }, "middle");
    expect((await canvasState(page, "first")).viewport, "middle drag still pans").not.toBe(
      beforeMiddlePan.viewport,
    );

    const beforeRightPan = await canvasState(page, "first");
    await dragFrom(page, await blankCanvasPoint(pane), { x: 36, y: 24 }, "right");
    expect((await canvasState(page, "first")).viewport, "right drag still pans").not.toBe(
      beforeRightPan.viewport,
    );

    const beforeWheel = await canvasState(page, "first");
    const wheelPoint = await blankCanvasPoint(pane);
    await page.mouse.move(wheelPoint.x, wheelPoint.y);
    await page.mouse.wheel(0, -120);
    await expect
      .poll(() => canvasState(page, "first"))
      .not.toMatchObject({
        viewport: beforeWheel.viewport,
      });
    await toolbar.getByRole("button", { name: "Fit", exact: true }).click();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));

    const beforeSpacePan = await canvasState(page, "first");
    await page.locator(".canvas-surface").focus();
    await page.keyboard.down("Space");
    await dragBy(page, firstNode, { x: 48, y: 24 });
    await page.keyboard.up("Space");
    const afterSpacePan = await canvasState(page, "first");
    expect(afterSpacePan.viewport, "Space drag still pans").not.toBe(beforeSpacePan.viewport);
    expect(afterSpacePan.node, "Space drag does not move an object").toBe(beforeSpacePan.node);
    expect(afterSpacePan.draft, "Space drag does not change YAML").toBe(beforeSpacePan.draft);

    await toolbar.locator('button[aria-label="Add transition"]').click();
    const beforeTransitionDrag = await canvasState(page, "second");
    await dragBy(page, secondNode, { x: 64, y: 32 });
    const afterTransitionDrag = await canvasState(page, "second");
    expect(afterTransitionDrag.node, "transition placement cannot move objects").toBe(
      beforeTransitionDrag.node,
    );
    expect(afterTransitionDrag.draft, "transition placement cannot change pinned layout").toBe(
      beforeTransitionDrag.draft,
    );
    await page.keyboard.press("Escape");

    await toolbar.getByRole("button", { name: "Select", exact: true }).click();
    const beforeObjectMove = await canvasState(page, "second");
    await dragBy(page, secondNode, { x: 64, y: 32 });
    await expect
      .poll(() => canvasState(page, "second"))
      .not.toMatchObject({
        node: beforeObjectMove.node,
        draft: beforeObjectMove.draft,
      });
    const afterObjectMove = await canvasState(page, "second");
    expect(afterObjectMove.viewport, "Select object drag keeps viewport").toBe(
      beforeObjectMove.viewport,
    );
    expect(afterObjectMove.draft, "Select object drag pins the layout").toContain("layout");

    expect(await toolbar.locator('select[aria-label="Add state"]').isEnabled()).toBe(true);
    expect(await toolbar.locator('button[aria-label="Add transition"]').isEnabled()).toBe(true);
  } finally {
    await browser.close();
    await service.stop();
    await fixture.close();
  }
});
