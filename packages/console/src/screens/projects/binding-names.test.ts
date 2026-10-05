// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { parseProjectReference, bindingName } from "./binding-names.ts";
test("Project references accept owner/number and GitHub Project URLs only", () => {
  expect(parseProjectReference(" example/12 ")).toEqual({ owner: "example", number: 12 });
  expect(
    parseProjectReference("https://github.com/orgs/example/projects/12/views/1?x=1#top"),
  ).toEqual({ owner: "example", number: 12 });
  expect(parseProjectReference("https://github.com/users/example/projects/12")).toEqual({
    owner: "example",
    number: 12,
  });
  for (const value of [
    "example/0",
    "example/1.5",
    "https://other.test/orgs/example/projects/1",
    "https://github.com/example/projects/1",
    "example/9007199254740992",
  ])
    expect(parseProjectReference(value)).toBeUndefined();
});
test("binding names are deterministic declared names of at most 64 characters", () => {
  expect(bindingName("Example_Group", 12)).toBe("example-group-12");
  expect(bindingName("123 Example", 1)).toBe("project-123-example-1");
  expect(bindingName("a".repeat(100), 2)).toHaveLength(64);
  expect(bindingName("Example Workspace")).toBe("example-workspace");
});
