// ---
// relationships:
//   verifies: epics-api
// ---
import { expect, test, vi, afterEach } from "vite-plus/test";
import { mapEpicResult, mapEpicRootsResult, fetchEpic, fetchEpicRoots } from "./epics.ts";
test("epics mappings distinguish valid, missing, and failed answers", () => {
  expect(mapEpicRootsResult(200, { roots: [] })).toEqual({ kind: "ok", roots: [] });
  expect(mapEpicRootsResult(200, { roots: [{}] }).kind).toBe("failed");
  expect(mapEpicRootsResult(500, { roots: [] }).kind).toBe("failed");
  expect(mapEpicResult(404, null)).toEqual({ kind: "missing" });
  expect(mapEpicResult(200, { epic: { root: "x", issues: [], dependencies: [] } }).kind).toBe(
    "failed",
  );
});

afterEach(() => vi.unstubAllGlobals());
test("epics client encodes node ids and maps network and JSON failures", async () => {
  const fetcher = vi.fn().mockResolvedValue({ status: 404 });
  vi.stubGlobal("fetch", fetcher);
  expect(await fetchEpic("parcel/%root")).toEqual({ kind: "missing" });
  expect(fetcher).toHaveBeenLastCalledWith("/api/epics/parcel%2F%25root");
  fetcher.mockResolvedValue({ status: 200, json: async () => ({ roots: [] }) });
  expect(await fetchEpicRoots()).toEqual({ kind: "ok", roots: [] });
  expect(fetcher).toHaveBeenLastCalledWith("/api/epics");
  fetcher.mockRejectedValue(new Error("offline"));
  expect((await fetchEpicRoots()).kind).toBe("failed");
  expect((await fetchEpic("parcel")).kind).toBe("failed");
  fetcher.mockResolvedValue({
    status: 200,
    json: async () => {
      throw new Error("not JSON");
    },
  });
  expect((await fetchEpicRoots()).kind).toBe("failed");
});
