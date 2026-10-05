// ---
// relationships:
//   verifies: agent-tools
// ---
import { expect, test } from "vite-plus/test";
import { questionTitle } from "./calls.ts";
const task = { repository: "example-org/widgets", number: 7 };
test.each([
  [
    { ...task, title: "Repaint the garden shed" },
    "Paint colour",
    "example-org/widgets#7: Paint colour — Repaint the garden shed",
  ],
  [
    { ...task, title: "Repaint the garden shed" },
    undefined,
    "example-org/widgets#7: Repaint the garden shed",
  ],
  [task, "Paint colour", "example-org/widgets#7: Paint colour"],
  [task, undefined, "example-org/widgets#7"],
  [undefined, "Paint colour", "Paint colour"],
  [undefined, undefined, "Question"],
] as const)("question title table: %j, %s", (context, title, expected) => {
  expect(questionTitle(context, title)).toBe(expected);
});
test("question titles cut at 120 Unicode code points and preserve the task first", () => {
  const prefix = "example-org/widgets#7: Paint colour — ";
  expect(
    questionTitle({ ...task, title: "🌻".repeat(120 - [...prefix].length) }, "Paint colour"),
  ).toBe(prefix + "🌻".repeat(120 - [...prefix].length));
  const cut = questionTitle({ ...task, title: "🌻".repeat(150) }, "Paint colour");
  expect([...cut]).toHaveLength(120);
  expect(cut).toBe(prefix + "🌻".repeat(119 - [...prefix].length) + "…");
});
