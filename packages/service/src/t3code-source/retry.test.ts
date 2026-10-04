// ---
// relationships:
//   verifies: t3code-environment-source
// ---
import { expect, test } from "vite-plus/test";
import { retryDelay } from "./retry.ts";
const policy = { initialMs: 1001, factor: 2, maxMs: 3000, jitter: 0.2 };
test.each([
  [0, 0, 901],
  [0, 0.5, 1001],
  [0, 1, 1101],
  [1, 0, 1802],
  [1, 1, 2202],
  [2, 0, 2700],
  [2, 1, 3000],
  [10000, 1, 3000],
])("credential retry attempt %s with random %s waits %s ms", (attempt, random, expected) => {
  expect(retryDelay(policy, attempt, random)).toBe(expected);
});
test("zero jitter returns the bounded base", () => {
  expect(retryDelay({ ...policy, jitter: 0 }, 1, 1)).toBe(2002);
  expect(retryDelay({ ...policy, jitter: 0 }, 2, 1)).toBe(3000);
});
