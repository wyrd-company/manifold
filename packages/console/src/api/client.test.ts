// ---
// relationships:
//   verifies: [actors-api, operator-console]
// ---
import { expect, test, vi, afterEach } from "vite-plus/test";
import { mapActorsResult, fetchActors } from "./client.ts";
const actor = {
  actorId: "sample",
  machine: "sample",
  states: ["ready"],
  savedAt: "2026-01-01T00:00:00.000Z",
};
afterEach(() => vi.unstubAllGlobals());
test("maps successful, unauthorized, disabled, malformed and failed API reads", () => {
  expect(mapActorsResult(200, { actors: [actor] })).toEqual({ kind: "ok", actors: [actor] });
  expect(mapActorsResult(401, null)).toEqual({ kind: "unauthorized" });
  expect(mapActorsResult(404, null)).toEqual({ kind: "disabled" });
  for (const body of [
    null,
    { actors: [{}] },
    { actors: [{ ...actor, states: [4] }] },
    { actors: [{ ...actor, savedAt: "invalid" }] },
    { actors: [{ ...actor, environment: 4 }] },
    { actors: [{ ...actor, blueprint: { path: "bad", commit: "bad" } }] },
    { actors: [actor], secret: true },
  ])
    expect(mapActorsResult(200, body).kind).toBe("failed");
  expect(mapActorsResult(500, null).kind).toBe("failed");
});
test("sends the kept bearer and keeps it out of errors", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ actors: [actor] })));
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("localStorage", { getItem: () => "sample-token" });
  expect((await fetchActors()).kind).toBe("ok");
  expect(fetch).toHaveBeenCalledWith("/api/actors", {
    headers: { Authorization: "Bearer sample-token" },
  });
  fetch.mockRejectedValue(new Error("sample-token"));
  expect(await fetchActors()).toEqual({
    kind: "failed",
    message: "Cannot read actors. Check the connection and try again.",
  });
});
test("omits authorization without a token and reports invalid JSON", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("invalid"));
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("localStorage", { getItem: () => null });
  expect((await fetchActors()).kind).toBe("failed");
  expect(fetch).toHaveBeenCalledWith("/api/actors", { headers: {} });
});
