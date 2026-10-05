// ---
// relationships:
//   verifies: [tasks-api, operator-console, escalation-contract]
// ---
import { expect, test, vi, afterEach } from "vite-plus/test";
import {
  mapTasksResult,
  mapTaskResult,
  mapAnswerResult,
  fetchTask,
  answerEscalation,
} from "./tasks.ts";
afterEach(() => vi.unstubAllGlobals());
test("maps valid reads, missing tasks, invalid bodies, and answer failures", () => {
  expect(mapTasksResult(200, { projects: [] })).toEqual({ kind: "ok", projects: [] });
  expect(mapTasksResult(200, {}).kind).toBe("failed");
  expect(mapTaskResult(404, null)).toEqual({ kind: "missing" });
  expect(mapTaskResult(200, {}).kind).toBe("failed");
  expect(mapAnswerResult(400, { error: "Choose a listed answer" })).toEqual({
    kind: "invalid",
    message: "Choose a listed answer",
  });
  expect(mapAnswerResult(404, null)).toEqual({ kind: "missing" });
  expect(mapAnswerResult(200, {}).kind).toBe("failed");
});
test("encodes identities and sends answers as JSON without authentication", async () => {
  const fetcher = vi.fn().mockResolvedValue({ status: 404 });
  vi.stubGlobal("fetch", fetcher);
  await fetchTask("task:parcel/a");
  expect(fetcher).toHaveBeenLastCalledWith("/api/tasks/task%3Aparcel%2Fa");
  await answerEscalation("sample", { text: "Deliver tomorrow" });
  expect(fetcher).toHaveBeenLastCalledWith("/api/escalations/sample/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: '{"text":"Deliver tomorrow"}',
  });
  fetcher.mockRejectedValue(new Error("offline"));
  expect((await fetchTask("task:parcel")).kind).toBe("failed");
});
