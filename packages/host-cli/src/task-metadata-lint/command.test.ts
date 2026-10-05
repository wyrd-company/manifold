// ---
// relationships:
//   verifies: [host-cli-task-metadata-lint, host-cli-blueprint-lint]
// ---
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test, vi } from "vite-plus/test";
import { taskMetadataLintCommand } from "./command.ts";
import { blueprintLintCommand } from "../blueprint-lint/command.ts";
test("metadata CLI reports declaration findings and blueprint repository errors before files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "metadata-cli-"));
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(await taskMetadataLintCommand([dir])).toBe(0);
    await writeFile(
      join(dir, "task-metadata.yml"),
      "projects: { parcels: { lifecycle: { field: Stage, options: [Packed] } } }",
    );
    expect(await taskMetadataLintCommand([dir])).toBe(1);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("task-metadata.yml:/projects/parcels unknown-binding"),
    );
    expect(await blueprintLintCommand(["--repository", dir, "missing.yml"])).toBe(2);
    expect(error).not.toHaveBeenCalledWith(expect.stringContaining("ENOENT"));
    expect(await taskMetadataLintCommand([join(dir, "missing")])).toBe(2);
    expect(await blueprintLintCommand(["--repository"])).toBe(2);
  } finally {
    log.mockRestore();
    error.mockRestore();
    await rm(dir, { recursive: true, force: true });
  }
});
