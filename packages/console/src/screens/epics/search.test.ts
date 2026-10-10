// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { epicsSearch } from "../EpicsContent.tsx";
test("epics search preserves only nonempty root and selection strings", () => {
  expect(epicsSearch({ root: "parcel", selected: "box", other: true })).toEqual({
    root: "parcel",
    selected: "box",
  });
  expect(epicsSearch({ root: 42, selected: "" })).toEqual({});
  expect(epicsSearch({ root: "", selected: null })).toEqual({});
});
