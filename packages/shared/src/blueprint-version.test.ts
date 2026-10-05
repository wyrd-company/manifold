// ---
// relationships:
//   verifies: blueprint
// ---
import { expect, it } from "vite-plus/test";
import {
  bundleDigest,
  blueprintVersionKey,
  parseBlueprintVersionKey,
} from "./blueprint-version.ts";
it("pins texts by path independently of insertion order and round-trips both sources", () => {
  const files = new Map([
    ["blueprints/b.yml", "second"],
    ["blueprints/a.yml", "first"],
  ]);
  const expected = "cbdaf1821afbf8ed25653c1a16b7c813bdc9d963680170d0fcde69c8615a4a39";
  expect(bundleDigest(files)).toBe(expected);
  expect(bundleDigest(new Map([...files].toReversed()))).toBe(expected);
  expect(bundleDigest(new Map([["blueprints/a.yml", "changed"]]))).not.toBe(expected);
  for (const version of [
    { commit: "a".repeat(40), path: "blueprints/a:b.yml" },
    { commit: "b".repeat(40), path: "blueprints/a.yml", bundle: expected },
  ])
    expect(parseBlueprintVersionKey(blueprintVersionKey(version))).toEqual(version);
  for (const key of [
    "blueprints/a.yml",
    `bad:blueprints/a.yml`,
    `${"a".repeat(40)}:blueprints/a.yml@bad`,
  ])
    expect(parseBlueprintVersionKey(key)).toBeUndefined();
});
