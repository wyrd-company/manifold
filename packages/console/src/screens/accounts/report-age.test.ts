// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { reportAge } from "./AccountsTable.tsx";
const now = Date.parse("2026-10-05T12:00:00Z");
test.each([
  [0, "1 minutes ago"],
  [-60000, "1 minutes ago"],
  [90000, "2 minutes ago"],
  [3599000, "60 minutes ago"],
  [3600000, "1 hours ago"],
  [5400000, "2 hours ago"],
  [86400000, "24 hours ago"],
  [172799000, "48 hours ago"],
  [172800000, "2 days ago"],
  [216000000, "3 days ago"],
])("report age for %i ms is %s", (elapsed, expected) => {
  expect(reportAge(new Date(now - elapsed).toISOString(), now)).toBe(expected);
});
