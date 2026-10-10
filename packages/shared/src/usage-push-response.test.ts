// ---
// relationships:
//   verifies: usage-push
// ---
import { expect, test } from "vite-plus/test";
import { isUsagePushResult } from "./usage-push-response.ts";

const result = {
  calls: { accepted: 1, pending: 0, unmetered: 2, replayed: 3 },
  threads: { accepted: 1, replayed: 0, conflicting: 0 },
  sourceErrors: 0,
};

test("usage push acknowledgement requires the unmetered call count", () => {
  expect(isUsagePushResult(result)).toBe(true);
  expect(
    isUsagePushResult({
      ...result,
      calls: (({ unmetered: _unmetered, ...calls }) => calls)(result.calls),
    }),
  ).toBe(false);
  expect(isUsagePushResult({ ...result, calls: { ...result.calls, unmetered: -1 } })).toBe(false);
});
