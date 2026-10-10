// ---
// relationships:
//   verifies: expressions
// ---
import { afterEach, expect, it } from "vite-plus/test";
import { createExpressionWorkerChannel } from "./expression-worker-channel.ts";
import type { ExpressionWorkerChannel } from "./expression-worker-channel.ts";

const channels: ExpressionWorkerChannel[] = [];
function channel(fixture = "worker") {
  const events: { pair: number; phase: "started" | "ended" }[] = [];
  const instance = createExpressionWorkerChannel({
    worker: new URL(`./expression-worker-fixtures/${fixture}.ts`, import.meta.url),
    onPair: (event) => events.push(event),
  });
  channels.push(instance);
  return { instance, events };
}
afterEach(async () => {
  await Promise.all(channels.splice(0).map((item) => item.close()));
});

it("releases an in-flight exit well before the bound and recovers on a new pair", () => {
  const { instance } = channel();
  const start = performance.now();
  expect(instance.evaluate({ operation: "exit" }, 4000)).toEqual({
    ok: false,
    cause: "exit",
    exitCode: 7,
  });
  expect(performance.now() - start).toBeLessThan(2000);
  expect(instance.evaluate({ operation: "answer", value: "next" }, 4000)).toEqual({
    ok: true,
    value: "next",
  });
});

it("keeps a published result when the worker exits immediately after", async () => {
  const { instance, events } = channel();
  expect(instance.evaluate({ operation: "answerThenExit", value: 42 }, 4000)).toEqual({
    ok: true,
    value: 42,
  });
  await expect.poll(() => events).toContainEqual({ pair: 1, phase: "ended" });
  expect(instance.evaluate({ operation: "answer", value: 43 }, 4000)).toEqual({
    ok: true,
    value: 43,
  });
});

it("retries an exit before take once and stops after two pairs", async () => {
  const { instance, events } = channel("exit-on-start");
  const start = performance.now();
  expect(instance.evaluate({}, 4000)).toEqual({ ok: false, cause: "exit", exitCode: 8 });
  expect(performance.now() - start).toBeLessThan(2000);
  await instance.close();
  for (const phase of ["started", "ended"] as const) {
    expect(
      events
        .filter((event) => event.phase === phase)
        .map((event) => event.pair)
        .toSorted(),
    ).toEqual([1, 2]);
  }
});

it("handles idle exit before the caller dispatches the pair-ended event", () => {
  const { instance, events } = channel();
  const signal = new SharedArrayBuffer(8);
  const view = new Int32Array(signal);
  expect(instance.evaluate({ operation: "idleExit", value: 1, signal }, 4000)).toEqual({
    ok: true,
    value: 1,
  });
  if (Atomics.load(view, 0) === 0) expect(Atomics.wait(view, 0, 0, 4000)).not.toBe("timed-out");
  expect(Atomics.load(view, 0)).toBe(1);
  Atomics.store(view, 1, 1);
  Atomics.notify(view, 1);
  expect(events).not.toContainEqual({ pair: 1, phase: "ended" });
  const start = performance.now();
  expect(instance.evaluate({ operation: "answer", value: 2 }, 4000)).toEqual({
    ok: true,
    value: 2,
  });
  expect(performance.now() - start).toBeLessThan(2000);
});

it("isolates late answers, ends discarded pairs, and closes twice", async () => {
  const { instance, events } = channel();
  // Warm the worker so the first failure occurs inside the handler.
  expect(instance.evaluate({ operation: "answer", value: 0 }, 4000)).toEqual({
    ok: true,
    value: 0,
  });
  for (let index = 0; index < 3; index++) {
    expect(instance.evaluate({ operation: "late", value: "old" }, 250)).toEqual({
      ok: false,
      cause: "timeout",
    });
  }
  expect(instance.evaluate({ operation: "answer", value: "current" }, 4000)).toEqual({
    ok: true,
    value: "current",
  });
  await expect.poll(() => events.filter((event) => event.phase === "ended").length).toBe(3);
  expect(events.filter((event) => event.phase === "started").map((event) => event.pair)).toEqual([
    1, 2, 3, 4,
  ]);
  await instance.close();
  await instance.close();
  expect(
    events
      .filter((event) => event.phase === "ended")
      .map((event) => event.pair)
      .sort(),
  ).toEqual([1, 2, 3, 4]);
});

it("keeps the retry inside the original deadline", () => {
  const { instance } = channel("slow-start-exit");
  const start = performance.now();
  expect(instance.evaluate({}, 350)).toEqual({ ok: false, cause: "timeout" });
  expect(performance.now() - start).toBeLessThan(600);
});
it("drops an answer carrying another evaluation sequence", () => {
  const { instance } = channel();
  expect(instance.evaluate({ operation: "stale", value: "own" }, 4000)).toEqual({
    ok: true,
    value: "own",
  });
});
