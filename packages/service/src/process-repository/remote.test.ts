// ---
// relationships:
//   verifies: process-repository
// ---
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import { openProcessRepository } from "./index.ts";
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

test("an empty GET keeps the backend response after early input closure", async () => {
  const directory = await fs.mkdtemp(join(tmpdir(), "remote-"));
  const remote = await fixture(directory);
  try {
    await remote.commit("example");
    remote.state.closeEmptyInput = true;
    const response = await fetch(`${remote.url}/info/refs?service=git-upload-pack`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/x-git-upload-pack-advertisement",
    );
    expect(await response.text()).toContain("refs/heads/main");
  } finally {
    await remote.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("a pull retains the Git reply when its empty request input closes early", async () => {
  const directory = await fs.mkdtemp(join(tmpdir(), "remote-"));
  const remote = await fixture(directory);
  try {
    const commit = await remote.commit("example");
    const repository = await openProcessRepository({
      configuration: {
        url: remote.url,
        branch: "main",
        directory: join(directory, "clone"),
        pullTimeoutMs: 60_000,
        credential: undefined,
        commitAuthor: { name: "Example", email: "example@example.test" },
      },
      credentials: {
        names: [],
        resolve() {
          throw new Error("Not used");
        },
      },
    });
    remote.state.closeEmptyInput = true;
    await expect(repository.pull()).resolves.toMatchObject({ kind: "advanced", commit });
    expect(await repository.current()!.read("recipes/a.txt")).toBe("example");
  } finally {
    await remote.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("a failed backend does not become a successful HTTP reply", async () => {
  const directory = await fs.mkdtemp(join(tmpdir(), "remote-"));
  const remote = await fixture(directory);
  try {
    await remote.commit("example");
    vi.stubEnv("GIT_CONFIG_PARAMETERS", "invalid");
    await expect(fetch(`${remote.url}/info/refs?service=git-upload-pack`)).rejects.toThrow(
      "fetch failed",
    );
  } finally {
    vi.unstubAllEnvs();
    await remote.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
