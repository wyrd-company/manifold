// ---
// relationships:
//   verifies: live-github-environment
// ---
import { test, expect } from "vite-plus/test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordedGitHub } from "./recorded-github.ts";
import { setHookState, hookEvents } from "./hooks.ts";
test("recorded hook reads conceal secrets and patches without secrets clear them", async () => {
  const github = recordedGitHub();
  github.hooks.set(1, {
    id: 1,
    active: true,
    events: ["issues"],
    config: {
      url: "https://example.invalid",
      content_type: "json",
      insecure_ssl: "0",
      secret: "synthetic-original",
    },
  });
  expect((await github.hook(1)).config.secret).toBeUndefined();
  expect((await github.listHooks())[0]!.config.secret).toBeUndefined();
  const result = await github.updateHook(1, { active: false });
  expect(result.config.secret).toBeUndefined();
  expect(github.hooks.get(1)!.config.secret).toBeUndefined();
  expect(result.events).toEqual(["push"]);
  expect(result.config.content_type).toBe("form");
});
test("start, reconnect, stop, sweep disable and both restore paths preserve the file secret and complete hook contract", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hook-contract-"));
  const github = recordedGitHub();
  github.hooks.set(1, {
    id: 1,
    active: false,
    events: ["issues"],
    config: {
      url: "https://hook.invalid/webhooks/github?owner-marker=sample",
      content_type: "json",
      insecure_ssl: "0",
      secret: "synthetic-old",
    },
  });
  try {
    await writeFile(join(directory, "hook.secret"), "synthetic-file-secret", { mode: 0o600 });
    for (const [active, url] of [
      [true, "https://first.invalid/webhooks/github?owner-marker=sample"],
      [true, "https://second.invalid/webhooks/github?owner-marker=sample"],
      [false, undefined],
      [true, undefined],
      [false, undefined],
      [true, undefined],
      [false, undefined],
      [true, undefined],
    ] as const) {
      await setHookState(github, directory, 1, active, url);
      const hook = github.hooks.get(1)!;
      expect(hook.active).toBe(active);
      expect(hook.events).toEqual(hookEvents);
      expect(hook.config).toEqual({
        url: url ?? "https://second.invalid/webhooks/github?owner-marker=sample",
        content_type: "json",
        insecure_ssl: "0",
        secret: "synthetic-file-secret",
      });
      expect((await github.hook(1)).config.secret).toBeUndefined();
      expect(github.hookPatches.at(-1)).toMatchObject({
        active,
        events: hookEvents,
        config: { secret: "synthetic-file-secret", content_type: "json", insecure_ssl: "0" },
      });
    }
    github.calls.length = 0;
    await setHookState(github, directory, 1, true);
    expect(github.writes()).toEqual([]);
    await writeFile(join(directory, "hook.secret"), "synthetic-replacement", { mode: 0o600 });
    await setHookState(github, directory, 1, false);
    expect(github.hooks.get(1)!.config.secret).toBe("synthetic-replacement");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
