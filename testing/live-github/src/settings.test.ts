// ---
// relationships:
//   verifies: live-github-environment
// ---
import { test, expect } from "vite-plus/test";
import { fileURLToPath } from "node:url";
import { stateDirectory } from "./settings.ts";
test("rejects a state directory inside the worktree before a credential file is written", () => {
  const previous = process.env["XDG_STATE_HOME"];
  try {
    process.env["XDG_STATE_HOME"] = fileURLToPath(new URL("../../../", import.meta.url));
    expect(() => stateDirectory()).toThrow("outside the worktree");
    process.env["XDG_STATE_HOME"] = "/tmp/example-state";
    expect(stateDirectory()).toBe("/tmp/example-state/manifold-live-github");
  } finally {
    if (previous === undefined) delete process.env["XDG_STATE_HOME"];
    else process.env["XDG_STATE_HOME"] = previous;
  }
});
