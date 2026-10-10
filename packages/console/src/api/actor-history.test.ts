// ---
// relationships:
//   verifies: [operator-console, actors-api]
// ---
import { expect, it } from "vite-plus/test";
import { isActorHistoryResponse, isActorsResponse } from "@wyrd-company/manifold-shared/actors-api";
import { sampleHistory } from "../screens/actors/test-fixtures.ts";
it("validates the history seam, pending commands, and completed summaries", () => {
  const h = sampleHistory();
  expect(isActorHistoryResponse({ history: h })).toBe(true);
  expect(isActorsResponse({ actors: [h.actor] })).toBe(true);
  for (const history of [
    { ...h, actor: { ...h.actor, status: "held" } },
    { ...h, visits: [{ ...h.visits[0], enteredAt: "bad" }] },
    { ...h, commands: [{ ...h.commands[0], sentAt: undefined }] },
    { ...h, events: [{ ...h.events[0], consumedAt: "bad" }] },
    { ...h, end: { status: "active", endedAt: h.actor.savedAt } },
  ])
    expect(isActorHistoryResponse({ history })).toBe(false);
});
