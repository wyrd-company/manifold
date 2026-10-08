// ---
// relationships:
//   verifies: [environments-api, operator-console]
// ---
import { afterEach, expect, test, vi } from "vite-plus/test";
import { actOnEnvironment, fetchEnvironments, mapEnvironmentResult } from "./environments.ts";
afterEach(() => vi.unstubAllGlobals());
test("maps validated success, API errors and malformed answers", () => {
  const body = { configurationFile: "service.yml", environments: [] };
  expect(mapEnvironmentResult("list", 200, body)).toEqual({ kind: "ok", body });
  const environment = {
    name: "site-a",
    host: "example.invalid",
    url: "http://example.invalid",
    status: "paused",
    connection: "connected",
    paused: true,
    disconnected: false,
    activeThreads: 1,
    scheduledThreads: 2,
  };
  expect(mapEnvironmentResult("action", 200, environment)).toEqual({
    kind: "ok",
    body: environment,
  });
  expect(mapEnvironmentResult("action", 200, body).kind).toBe("failed");
  expect(mapEnvironmentResult("list", 200, {}).kind).toBe("failed");
  expect(
    mapEnvironmentResult("action", 500, {
      error: { kind: "action-failed", message: "Store unavailable" },
    }),
  ).toEqual({ kind: "failed", message: "Store unavailable" });
  expect(mapEnvironmentResult("action", 404, {}).kind).toBe("failed");
});
test("requests same-origin endpoints with encoded path segments and handles network failures", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ configurationFile: "service.yml", environments: [] })),
    );
  vi.stubGlobal("fetch", fetch);
  await fetchEnvironments();
  expect(fetch.mock.calls[0]?.[0]).toBe("/api/environments");
  await actOnEnvironment("site/a", "pause");
  expect(fetch.mock.calls[1]).toEqual(["/api/environments/site%2Fa/pause", { method: "POST" }]);
  fetch.mockRejectedValue(new Error("offline"));
  expect((await fetchEnvironments()).kind).toBe("failed");
  fetch.mockResolvedValue(new Response("invalid"));
  expect((await fetchEnvironments()).kind).toBe("failed");
});
