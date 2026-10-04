// ---
// relationships:
//   verifies: expressions
// ---
import { expect, it } from "vite-plus/test";
import {
  claim,
  confirm,
  take,
  complete,
  recordExit,
  abandon,
  release,
  states,
  words,
} from "./expression-worker-protocol.ts";

function buffer() {
  return new Int32Array(new SharedArrayBuffer(12));
}

it.each(["before claim", "between claim and confirm", "after confirm"])(
  "records idle exit %s without stranding pending",
  (order) => {
    const view = buffer();
    if (order === "before claim") recordExit(view, 7);
    expect(claim(view)).toBe(true);
    if (order === "between claim and confirm") recordExit(view, 7);
    expect(confirm(view)).toBe(order === "after confirm");
    if (order === "after confirm") recordExit(view, 7);
    expect(Atomics.load(view, words.state)).toBe(states.untaken);
    expect(Atomics.load(view, words.exitCode)).toBe(7);
  },
);

it("keeps completion when exit or abandonment follows it", () => {
  const view = buffer();
  claim(view);
  confirm(view);
  take(view);
  expect(complete(view)).toBe(true);
  recordExit(view, 9);
  expect(abandon(view)).toBe(false);
  expect(Atomics.load(view, words.state)).toBe(states.done);
  expect(release(view)).toBe(true);
  expect(Atomics.load(view, words.state)).toBe(states.idle);
});

it("keeps exit when completion or abandonment follows it", () => {
  const view = buffer();
  claim(view);
  confirm(view);
  take(view);
  recordExit(view, 9);
  expect(complete(view)).toBe(false);
  expect(abandon(view)).toBe(false);
  expect(Atomics.load(view, words.state)).toBe(states.failed);
});

it.each([false, true])(
  "abandons a request (taken: %s) and rejects late take and completion",
  (taken) => {
    const view = buffer();
    claim(view);
    confirm(view);
    if (taken) take(view);
    expect(abandon(view)).toBe(true);
    expect(take(view)).toBe(false);
    expect(complete(view)).toBe(false);
    recordExit(view, 1);
    expect(Atomics.load(view, words.state)).toBe(states.abandoned);
  },
);
