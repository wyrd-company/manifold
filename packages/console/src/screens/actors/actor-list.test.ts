// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, it } from "vite-plus/test";
import { actorsSearch, filterActors } from "./actor-list.ts";
it("preserves only declared search values and matches all filters", () => {
  const actor = {
    actorId: "one",
    status: "active" as const,
    machine: "sample",
    states: ["working"],
    savedAt: "2026-01-01T00:00:00.000Z",
    portfolioItem: "alpha",
    environment: "sample",
  };
  expect(actorsSearch({ status: "completed", item: "alpha", account: 4, secret: "x" })).toEqual({
    status: "completed",
    item: "alpha",
  });
  expect(
    filterActors([{ actor, accounts: ["first"] }], { item: "alpha", account: "second" }),
  ).toEqual([]);
  expect(
    filterActors([{ actor, accounts: ["first"] }], { item: "alpha", account: "first" }),
  ).toHaveLength(1);
});
