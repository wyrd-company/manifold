// ---
// relationships:
//   verifies: service-assembly
// ---
import { expect, test } from "vite-plus/test";
import { assembleService, wiringPart } from "./index.ts";
import type { Later, ServiceLogEntry } from "./index.ts";
const options = { configurationFile: "unused", log: () => {} };
test("one list entry joins a part, reads its predecessor and stops before it within a stage", async () => {
  const calls: string[] = [];
  const first = wiringPart({
    name: "first",
    start: (_: object, context) => {
      calls.push("first");
      context.onStop("store", () => {
        calls.push("close-first");
      });
      return { first: 7 };
    },
  });
  const second = wiringPart({
    name: "second",
    start: (members: { first: number }, context) => {
      calls.push(`second-${members.first}`);
      context.onStop("store", () => {
        calls.push("close-second");
      });
      context.onStop("requests", () => {
        calls.push("requests");
      });
      return {};
    },
  });
  const service = await assembleService(options).part(first).part(second).start();
  expect(service.members.first).toBe(7);
  const stopped = service.stop();
  expect(service.stop()).toBe(stopped);
  await stopped;
  expect(calls).toEqual(["first", "second-7", "requests", "close-second", "close-first"]);
});
test("a part that throws closes what it registered and skips later entries", async () => {
  const calls: string[] = [];
  const failure = new Error("opening failed");
  await expect(
    assembleService(options)
      .part(
        wiringPart({
          name: "first",
          start: (_: object, context) => {
            context.onStop("store", () => {
              calls.push("closed");
            });
            throw failure;
          },
        }),
      )
      .part(
        wiringPart({
          name: "second",
          start: () => {
            calls.push("second");
            return {};
          },
        }),
      )
      .start(),
  ).rejects.toBe(failure);
  expect(calls).toEqual(["closed"]);
});
test("stop failures name their part and still close the store", async () => {
  const logs: ServiceLogEntry[] = [];
  const calls: string[] = [];
  const failure = new Error("stop failed");
  const service = await assembleService({ ...options, log: (entry) => logs.push(entry) })
    .part(
      wiringPart({
        name: "sample",
        start: (_: object, context) => {
          context.onStop("commands", () => {
            throw failure;
          });
          context.onStop("store", () => {
            calls.push("closed");
          });
          return {};
        },
      }),
    )
    .start();
  await expect(service.stop()).rejects.toBe(failure);
  expect(calls).toEqual(["closed"]);
  expect(logs).toContainEqual({
    level: "error",
    event: "stop-failed",
    message: "Failed stop step: sample",
  });
});
test("later checks membership, names an unstarted part, resolves readiness and respects abort", async () => {
  const target = wiringPart({ name: "target", start: () => ({ value: 9 }) });
  let late!: Later<{ value: number }>;
  let ready!: Promise<{ value: number }>;
  const reason = new Error("cancelled");
  const abort = new AbortController();
  const service = await assembleService(options)
    .part(
      wiringPart({
        name: "first",
        start: async (_: object, context) => {
          expect(() => context.later(wiringPart({ name: "missing", start: () => ({}) }))).toThrow(
            /missing/,
          );
          late = context.later(target);
          expect(late.current()).toBeUndefined();
          expect(() => late.get()).toThrow(/target/);
          ready = late.ready();
          const waiting = late.ready(abort.signal);
          abort.abort(reason);
          await expect(waiting).rejects.toBe(reason);
          await expect(late.ready(abort.signal)).rejects.toBe(reason);
          return {};
        },
      }),
    )
    .part(target)
    .start();
  expect(await ready).toEqual({ value: 9 });
  expect(late.get()).toEqual({ value: 9 });
  expect(late.current()).toEqual({ value: 9 });
  expect(await late.ready()).toEqual({ value: 9 });
  await service.stop();
});
test("implementation registration closes when blueprint-loader starts", async () => {
  const registry = { actors: {}, actions: {}, guards: {}, delays: {} };
  await expect(
    assembleService(options)
      .part(wiringPart({ name: "blueprint-loader", start: () => ({}) }))
      .part(
        wiringPart({
          name: "late",
          start: (_: object, context) => {
            context.addImplementations(registry);
            return {};
          },
        }),
      )
      .start(),
  ).rejects.toThrow(/blueprint-loader/);
});
// Compile-time contracts: these lists never start.
function types() {
  const first = wiringPart({ name: "first", start: () => ({ value: 1 }) });
  const needs = wiringPart({
    name: "needs",
    start: (_members: { value: number }) => ({ other: 2 }),
  });
  // @ts-expect-error A required predecessor is absent.
  assembleService(options).part(needs);
  // @ts-expect-error A member name cannot be repeated.
  assembleService(options).part(first).part(first);
  // @ts-expect-error The initial log member cannot be repeated.
  assembleService(options).part(wiringPart({ name: "log", start: () => ({ log: () => {} }) }));
  assembleService(options)
    .part(first)
    .part(needs)
    .part(wiringPart({ name: "empty", start: () => ({}) }));
}
void types;

test("part names are unique and later identifies a part by its object", async () => {
  const first = wiringPart({ name: "sample", start: () => ({}) });
  expect(() => assembleService(options).part(first).part(first)).toThrow(/sample/);
  const copy = wiringPart({ ...first });
  const service = await assembleService(options)
    .part(
      wiringPart({
        name: "reader",
        start: (_: object, context) => {
          expect(() => context.later(copy)).toThrow(/sample/);
          return {};
        },
      }),
    )
    .part(first)
    .start();
  await service.stop();
});
test("a failed stop probe does not prevent later stages and rejects with its error", async () => {
  const failure = new Error("probe failed");
  const closed: string[] = [];
  const service = await assembleService({
    ...options,
    probes: {
      step: (step) => {
        if (step === "http-closed") throw failure;
      },
    },
  })
    .part(
      wiringPart({
        name: "sample",
        start: (_: object, context) => {
          context.onStop("requests", () => {
            closed.push("requests");
          });
          context.onStop("store", () => {
            closed.push("store");
          });
          return {};
        },
      }),
    )
    .start();
  await expect(service.stop()).rejects.toBe(failure);
  expect(closed).toEqual(["requests", "store"]);
});
test("a source stop failure skips its completed step and still stops other sources", async () => {
  const failure = new Error("source failed");
  const steps: string[] = [];
  const closed: string[] = [];
  const service = await assembleService({
    ...options,
    probes: {
      step: (step) => {
        steps.push(step);
      },
    },
  })
    .part(
      wiringPart({
        name: "first",
        start: (_: object, context) => {
          context.onStop("sources", () => {
            closed.push("first");
          });
          return {};
        },
      }),
    )
    .part(
      wiringPart({
        name: "second",
        start: (_: object, context) => {
          context.onStop("sources", () => {
            throw failure;
          });
          return {};
        },
      }),
    )
    .start();
  await expect(service.stop()).rejects.toBe(failure);
  expect(closed).toEqual(["first"]);
  expect(steps).not.toContain("sources-stopped");
});

test("an already aborted start opens no part", async () => {
  const abort = new AbortController();
  const reason = new Error("cancelled");
  abort.abort(reason);
  let opened = false;
  await expect(
    assembleService({ ...options, signal: abort.signal })
      .part(
        wiringPart({
          name: "sample",
          start: () => {
            opened = true;
            return {};
          },
        }),
      )
      .start(),
  ).rejects.toBe(reason);
  expect(opened).toBe(false);
});
