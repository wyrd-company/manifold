// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { sharingFor } from "./sharing.ts";
const preview = [{ account: "acct", items: [{ item: "alpha", alone: 70, allWaiting: 66.66 }] }];
test("sharing cells use the selected account and hide answers with findings", () => {
  expect(sharingFor({ findings: [], warnings: [], preview }, "acct", "alpha")).toEqual(
    preview[0]!.items[0],
  );
  expect(sharingFor({ findings: [], warnings: [], preview }, "missing", "alpha")).toBeUndefined();
  expect(
    sharingFor(
      { findings: [{ kind: "schema", location: "", message: "Invalid" }], warnings: [], preview },
      "acct",
      "alpha",
    ),
  ).toBeUndefined();
});
