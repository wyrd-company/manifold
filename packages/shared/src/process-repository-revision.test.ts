// ---
// relationships:
//   verifies: process-repository
// ---
import { expect, test } from "vite-plus/test";
import { memoryRevision } from "./index.ts";

test("revision copies files and lists only descendants in sorted order", async () => {
  const files = { "z.txt": "last", "recipes/z.txt": "z", "recipes/a.txt": "a" };
  const revision = memoryRevision("a".repeat(40), files);
  files["recipes/a.txt"] = "changed";
  expect(await revision.read("recipes/a.txt")).toBe("a");
  expect(await revision.read("recipes")).toBeUndefined();
  expect(await revision.read("missing")).toBeUndefined();
  expect(await revision.list("")).toEqual(["recipes/a.txt", "recipes/z.txt", "z.txt"]);
  expect(await revision.list("recipes")).toEqual(["recipes/a.txt", "recipes/z.txt"]);
  expect(await revision.list("z.txt")).toEqual([]);
});
test.each(["/", "a/", "./a", "../a", "a//b", "a\\b", ""])(
  "revision rejects malformed read path %j",
  async (path) => {
    const revision = memoryRevision("a".repeat(40), {});
    await expect(revision.read(path)).rejects.toThrow(TypeError);
    if (path) await expect(revision.list(path)).rejects.toThrow(TypeError);
  },
);
test("revision rejects invalid commit and file keys", () => {
  expect(() => memoryRevision("main", {})).toThrow(TypeError);
  expect(() => memoryRevision("a".repeat(40), { "../x": "" })).toThrow(TypeError);
});
