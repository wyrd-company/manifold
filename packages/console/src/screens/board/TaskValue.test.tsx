// ---
// relationships:
//   verifies: [operator-console, tasks-api]
// ---
import { expect, test } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskValue } from "./TaskValue.tsx";
test("task values show set zero, empty, invalid and unavailable as separate states", () => {
  expect(renderToStaticMarkup(<TaskValue value={{ state: "set", value: 0 }} />)).toBe("0");
  expect(renderToStaticMarkup(<TaskValue value={{ state: "empty" }} />)).toContain("Empty");
  expect(
    renderToStaticMarkup(<TaskValue value={{ state: "invalid", detail: "Wrong type" }} />),
  ).toContain("Cannot read");
  expect(
    renderToStaticMarkup(<TaskValue value={{ state: "unavailable", detail: "No observation" }} />),
  ).toContain("Not available");
});
