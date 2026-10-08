// ---
// relationships:
//   verifies: [operator-console, escalation-contract]
// ---
import { expect, test, vi } from "vite-plus/test";
import { fetchEscalations, mapEscalationsResult } from "./escalations.ts";
test("list mapping accepts the validated list only on 200", () => {
  expect(mapEscalationsResult(200, { escalations: [] })).toEqual({ kind: "ok", escalations: [] });
  for (const [status, body] of [
    [200, {}],
    [200, { escalations: [{}] }],
    [500, { escalations: [] }],
  ])
    expect(mapEscalationsResult(Number(status), body).kind).toBe("failed");
});
test("read sends the selected status, without authentication, and resolves network/JSON errors", async () => {
  const mock = vi.spyOn(globalThis, "fetch");
  try {
    mock.mockResolvedValue(new Response(JSON.stringify({ escalations: [] }), { status: 200 }));
    expect(await fetchEscalations("open")).toEqual({ kind: "ok", escalations: [] });
    expect(mock).toHaveBeenCalledWith("/api/escalations?status=open");
    mock.mockRejectedValue(Error("offline"));
    expect((await fetchEscalations("answered")).kind).toBe("failed");
    mock.mockResolvedValue(new Response("invalid", { status: 200 }));
    expect((await fetchEscalations("open")).kind).toBe("failed");
  } finally {
    mock.mockRestore();
  }
});
