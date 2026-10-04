// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { navigation } from "./navigation.ts";
test("every sidebar screen has one unique route, in visual design order", () => {
  expect(navigation.map((item) => item.label)).toEqual([
    "Overview",
    "Board",
    "Epics",
    "Actors",
    "Portfolio",
    "Blueprints",
    "GitHub Projects",
    "Environments",
    "Settings",
  ]);
  expect(new Set(navigation.map((item) => item.path)).size).toBe(navigation.length);
  expect(navigation.map((item) => item.path)).toEqual([
    "/",
    "/board",
    "/epics",
    "/actors",
    "/portfolio",
    "/blueprints",
    "/projects",
    "/environments",
    "/settings",
  ]);
});
