// ---
// relationships:
//   verifies: [host-cli, host-command-catalog]
// ---
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { spawnSync } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { childArtifacts } from "../../../test-support/child-process.ts";

import { commandTree } from "./catalog/command-tree.generated.ts";
import { commandNodes, renderHelp, renderUsage } from "./catalog/catalog.ts";

const nodes = commandNodes(commandTree);
let directory: string;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "host-help-"));
  await expect(access(join(directory, "node_modules"))).rejects.toThrow();
});
afterAll(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});
function run(args: string[]) {
  const result = spawnSync(childArtifacts().host, args, { cwd: directory, encoding: "utf8" });
  expect(result.error).toBeUndefined();
  return result;
}
test.each([[], ["--help"], ["-h"], ["help"]].map((args) => ({ args })))(
  "root help for $args",
  ({ args }) => {
    const result = run(args);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Usage:\n  manifold-host <command> [flags]");
    expect(result.stdout).toContain("usage push");
    expect(result.stdout).toBe(renderHelp(nodes[0]!));
  },
);
test("unknown command is refused with usage", () => {
  const result = run(["missing"]);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("manifold-host: unknown command 'missing'\n");
  expect(result.stderr).toContain("Usage:");
});

test.each(nodes.map((node) => ({ node, path: node.path.join(" ") || "root" })))(
  "compiled help for $path",
  ({ node }) => {
    for (const args of [
      [...node.path, "--help"],
      [...node.path, "-h"],
      ["help", ...node.path],
      ...(node.subcommands ? [[...node.path]] : []),
    ]) {
      const result = run(args);
      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toBe(renderHelp(node));
    }
  },
);
test.each([
  { args: ["help", "missing"], path: "", message: "unknown command 'missing'" },
  { args: ["usage", "--missing"], path: "usage", message: "unknown flag '--missing' for 'usage'" },
  { args: ["usage", "missing"], path: "usage", message: "unknown command 'usage missing'" },
  { args: ["--missing=value"], path: "", message: "unknown flag '--missing'" },
  {
    args: ["usage", "push", "--missing"],
    path: "usage push",
    message: "unknown flag '--missing' for 'usage push'",
  },
  { args: ["help", "usage", "missing"], path: "usage", message: "unknown command 'usage missing'" },
  {
    args: ["help", "usage", "push", "extra"],
    path: "usage push",
    message: "unknown command 'usage push extra'",
  },
  {
    args: ["help", "usage", "push", "--service"],
    path: "help",
    message: "unknown flag '--service' for 'help'",
  },
])("compiled refusal for $args", ({ args, path, message }) => {
  const result = run(args);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe("");
  const node = nodes.find((node) => node.path.join(" ") === path)!;
  expect(result.stderr).toBe(`manifold-host: ${message}\n\n${renderUsage(node)}`);
});
test("compiled help wins over unknown flags and does not start MCP or push", () => {
  for (const path of [["usage", "push"], ["mcp"]]) {
    const result = run([...path, "--missing", "--help"]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(
      renderHelp(nodes.find((node) => node.path.join(" ") === path.join(" "))!),
    );
  }
});
