// ---
// relationships:
//   verifies: [usage-api, operator-console]
// ---
import { expect, test } from "vite-plus/test";
import { mapMoveResult, mapUnownedResult } from "./usage.ts";
test("usage client rejects malformed success bodies and preserves refusal messages", () => {
  expect(mapMoveResult(200, {})).toMatchObject({ kind: "failed" });
  expect(mapMoveResult(422, { error: "unknown-actor", message: "Not started" })).toEqual({
    kind: "refused",
    error: "unknown-actor",
    message: "Not started",
  });
  expect(
    mapMoveResult(200, {
      status: "moved",
      from: "session:env-one:codex:one",
      to: { actor: "task:one", item: "alpha" },
      moved: 0,
      accounts: [],
    }),
  ).toMatchObject({ kind: "ok" });
  expect(
    mapUnownedResult(200, {
      unowned: [
        {
          actor: "thread:env-one:one",
          kind: "thread",
          environment: "env-one",
          threadId: "one",
          lastUsedAt: new Date(0).toISOString(),
          pending: 1,
          unmetered: 0,
          usage: [],
        },
      ],
    }),
  ).toMatchObject({ kind: "ok" });
  expect(mapUnownedResult(200, { unowned: [{}] })).toMatchObject({ kind: "failed" });
});
