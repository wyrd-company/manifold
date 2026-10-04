// ---
// relationships:
//   verifies: process-repository
// ---
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { fixture } from "./test-fixtures/remote.ts";

test("an early backend exit consumes pipe errors and the next request succeeds", async () => {
  const directory = await fs.mkdtemp(join(tmpdir(), "remote-"));
  const remote = await fixture(directory);
  try {
    await remote.commit("example");
    // The missing path makes http-backend exit without consuming its stdin.
    // A body larger than the pipe buffer leaves a write pending when it exits.
    const failed = await fetch(`${remote.url}/missing`, {
      method: "POST",
      body: Buffer.alloc(4 * 1024 * 1024),
    }).catch(() => undefined);
    expect([undefined, 404]).toContain(failed?.status);
    await failed?.arrayBuffer();
    const next = await fetch(`${remote.url}/info/refs?service=git-upload-pack`);
    expect(next.status).toBe(200);
    expect(await next.text()).toContain("refs/heads/main");
  } finally {
    await remote.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
