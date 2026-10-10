// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, it } from "vite-plus/test";
import { recordEdit, undo, redo } from "./canvas-history.ts";
it("undo and redo only on their recorded basis; outside edits clear history", () => {
  const history = recordEdit({ undo: [], redo: [] }, "a", "b");
  const previous = undo(history, "b");
  expect(previous.text).toBe("a");
  expect(redo(previous.history, "a").text).toBe("b");
  expect(redo(previous.history, "outside")).toEqual({
    text: "outside",
    history: { undo: [], redo: [] },
  });
  expect(undo(history, "outside")).toEqual({ text: "outside", history: { undo: [], redo: [] } });
});
it("retains at most one hundred edits and clears redo for a new gesture", () => {
  let history = {
    undo: [] as { before: string; after: string }[],
    redo: [] as { before: string; after: string }[],
  };
  for (let i = 0; i < 110; i++) history = recordEdit(history, String(i), String(i + 1));
  expect(history.undo).toHaveLength(100);
  expect(recordEdit(undo(history, "110").history, "109", "new").redo).toEqual([]);
});
