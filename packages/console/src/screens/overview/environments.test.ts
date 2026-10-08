// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test, vi } from "vite-plus/test";
import {
  fetchEnvironments,
  isEnvironmentsResponse,
  mapEnvironmentsResult,
} from "./environments.ts";
const entry = {
  name: "north",
  host: "https://example.test",
  status: "connected",
  activeThreads: 2,
  scheduledThreads: 1,
};
test("environment stand-in validates the ruled shape at the boundary", () => {
  for (const status of ["connected", "connecting", "disconnected", "paused"])
    expect(
      isEnvironmentsResponse({ environments: [{ ...entry, status, activeThreads: null }] }),
    ).toBe(true);
  for (const body of [
    {},
    { environments: null },
    { environments: [], extra: true },
    { environments: [null] },
    ...[
      { status: "unknown" },
      { name: 3 },
      { host: null },
      { activeThreads: -1 },
      { activeThreads: 1.5 },
      { scheduledThreads: null },
      { scheduledThreads: -1 },
      { extra: true },
    ].map((change) => ({ environments: [{ ...entry, ...change }] })),
  ])
    expect(isEnvironmentsResponse(body)).toBe(false);
  expect(mapEnvironmentsResult(200, { environments: [entry] })).toEqual({
    kind: "ok",
    environments: [entry],
  });
  expect(mapEnvironmentsResult(500, { environments: [entry] }).kind).toBe("failed");
  expect(mapEnvironmentsResult(200, {}).kind).toBe("failed");
});
test("environment read resolves network and malformed JSON failures", async () => {
  const mock = vi.spyOn(globalThis, "fetch");
  try {
    mock.mockResolvedValue(
      new Response(JSON.stringify({ environments: [entry] }), { status: 200 }),
    );
    expect((await fetchEnvironments()).kind).toBe("ok");
    expect(mock).toHaveBeenCalledWith("/api/environments");
    mock.mockRejectedValue(Error("offline"));
    expect((await fetchEnvironments()).kind).toBe("failed");
    mock.mockResolvedValue(new Response("invalid", { status: 200 }));
    expect((await fetchEnvironments()).kind).toBe("failed");
  } finally {
    mock.mockRestore();
  }
});
