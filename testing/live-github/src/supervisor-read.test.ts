// ---
// relationships:
//   verifies: live-github-environment
// ---
import { expect, test, vi } from "vite-plus/test";
const { readFile } = vi.hoisted(() => ({ readFile: vi.fn() }));
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs/promises")>()),
  readFile,
}));
import { processStartTime } from "./supervisor.ts";
test("a process that disappears during its identity read is absent; other read failures remain errors", async () => {
  for (const code of ["ENOENT", "ESRCH"]) {
    readFile.mockRejectedValueOnce(Object.assign(Error("synthetic process disappeared"), { code }));
    await expect(processStartTime(123)).resolves.toBeUndefined();
  }
  readFile.mockRejectedValueOnce(Object.assign(Error("synthetic read denied"), { code: "EACCES" }));
  await expect(processStartTime(123)).rejects.toThrow("synthetic read denied");
});
