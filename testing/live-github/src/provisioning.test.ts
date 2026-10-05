// ---
// relationships:
//   verifies: live-github-environment
// ---
import { describe, expect, it } from "vite-plus/test";
import { mkdtemp, readFile, rm, mkdir, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { provision as provisionResources, teardown } from "./provisioning.ts";
import { recordedGitHub } from "./recorded-github.ts";
import { writeConfiguration } from "./configuration.ts";
async function provision(options: Parameters<typeof provisionResources>[0]) {
  const resources = await provisionResources(options);
  if (
    await writeConfiguration(options.settings, options.directory, resources, {
      appId: 1,
      installationId: 2,
    })
  )
    await options.afterWrite?.("service.yml");
  return resources;
}
const settings = {
  organization: "example-org",
  marker: "test-owned",
  repository: "fixture-app",
  processRepository: "fixture-settings",
  project: "Fixture board",
  seedIssues: 2,
  credentials: {
    patFile: "unused",
    pinggyTokenFile: "unused",
    appEnvFile: "unused",
    appPrivateKeyFile: "unused",
  },
  pinggyHost: "unused",
  sweepIntervalMs: 60000,
};
const files = {
  "bindings.yml":
    "githubProjects:\n  board:\n    owner: old\n    number: 99\n    item: sample\n    environment: local\n",
  "README.md": "sample",
};
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "live-provision-"));
  return {
    directory,
    github: recordedGitHub(),
    dispose: () => rm(directory, { recursive: true, force: true }),
  };
}
describe("provisioning convergence", () => {
  it("creates owned resources and repeats without any write", async () => {
    const f = await fixture();
    try {
      const resources = await provision({
        settings,
        directory: f.directory,
        github: f.github,
        files,
      });
      expect(resources.issues).toHaveLength(2);
      expect(f.github.unmarked()).toEqual([]);
      f.github.calls.length = 0;
      const effects: string[] = [];
      await provision({
        settings,
        directory: f.directory,
        github: f.github,
        files,
        afterWrite: async (name) => {
          effects.push(name);
        },
      });
      expect(f.github.writes()).toEqual([]);
      expect(effects).toEqual([]);
    } finally {
      await f.dispose();
    }
  });
  it("recovers after each GitHub and file write", async () => {
    const clean = await fixture();
    let effects = 0;
    try {
      await provision({
        settings,
        directory: clean.directory,
        github: clean.github,
        files,
        afterWrite: async () => {
          effects++;
        },
      });
    } finally {
      await clean.dispose();
    }
    for (let n = 1; n <= effects; n++) {
      const f = await fixture();
      let count = 0;
      try {
        await expect(
          provision({
            settings,
            directory: f.directory,
            github: f.github,
            files,
            afterWrite: async () => {
              if (++count === n) throw Error("interrupted");
            },
          }),
        ).rejects.toThrow("interrupted");
        await provision({ settings, directory: f.directory, github: f.github, files });
        expect(f.github.unmarked()).toEqual([]);
        expect(f.github.repositories.size).toBe(2);
        expect(f.github.issues.size).toBe(2);
        expect(f.github.projects.size).toBe(1);
        expect(f.github.hooks.size).toBe(1);
        expect([...f.github.hooks.values()][0]?.config.secret).toBe(
          (await readFile(join(f.directory, "hook.secret"), "utf8")).trim(),
        );
      } finally {
        await f.dispose();
      }
    }
  });
  it("recovers a lost secret and a hook update before secret rename", async () => {
    for (const stage of ["hook.secret.pending", "github:hook.update"]) {
      const f = await fixture();
      try {
        await provision({ settings, directory: f.directory, github: f.github, files });
        await rm(join(f.directory, "hook.secret"));
        await expect(
          provision({
            settings,
            directory: f.directory,
            github: f.github,
            files,
            afterWrite: async (name) => {
              if (name === stage) throw Error("interrupted");
            },
          }),
        ).rejects.toThrow("interrupted");
        await provision({ settings, directory: f.directory, github: f.github, files });
        expect([...f.github.hooks.values()][0]?.config.secret).toBe(
          (await readFile(join(f.directory, "hook.secret"), "utf8")).trim(),
        );
      } finally {
        await f.dispose();
      }
    }
  });
  it("refuses a foreign name and leaves it on teardown", async () => {
    const f = await fixture();
    try {
      f.github.foreignRepository(settings.repository);
      await expect(
        provision({ settings, directory: f.directory, github: f.github, files }),
      ).rejects.toThrow("foreign");
      await teardown({ settings, directory: f.directory, github: f.github });
      expect(f.github.repositories.size).toBe(1);
    } finally {
      await f.dispose();
    }
  });
  it("tears down and recovers after each removal", async () => {
    for (let failure = 0; failure <= 12; failure++) {
      const f = await fixture();
      try {
        await provision({ settings, directory: f.directory, github: f.github, files });
        for (const name of ["service", "tunnel", "smoke"])
          await mkdir(join(f.directory, name), { mode: 0o700 });
        for (const name of [
          "service/manifold.sqlite",
          "tunnel/ssh.conf",
          "children.json",
          "hook.secret.pending",
          "smoke/example.log",
        ])
          await writeFile(join(f.directory, name), "synthetic test state", { mode: 0o600 });
        let n = 0;
        try {
          await teardown({
            settings,
            directory: f.directory,
            github: f.github,
            afterWrite: async () => {
              if (++n === failure) throw Error("interrupted");
            },
          });
        } catch (error) {
          expect(String(error)).toContain("interrupted");
        }
        await teardown({ settings, directory: f.directory, github: f.github });
        expect(f.github.repositories.size + f.github.projects.size + f.github.hooks.size).toBe(0);
        for (const name of [
          "hook.secret",
          "hook.secret.pending",
          "service.yml",
          "service",
          "tunnel",
          "children.json",
          "resources.json",
        ])
          await expect(stat(join(f.directory, name))).rejects.toMatchObject({ code: "ENOENT" });
        expect(await readFile(join(f.directory, "smoke/example.log"), "utf8")).toBe(
          "synthetic test state",
        );
        f.github.calls.length = 0;
        await teardown({ settings, directory: f.directory, github: f.github });
        expect(f.github.writes()).toEqual([]);
      } finally {
        await f.dispose();
      }
    }
  });
  it("refuses a foreign Project and preserves foreign hooks on teardown", async () => {
    const f = await fixture();
    try {
      f.github.projects.set("FOREIGN", { id: "FOREIGN", title: settings.project, number: 8 });
      f.github.hooks.set(99, {
        id: 99,
        active: true,
        events: ["issues"],
        config: { url: "https://example.invalid/webhooks/github" },
      });
      await expect(
        provision({ settings, directory: f.directory, github: f.github, files }),
      ).rejects.toThrow("foreign project");
      await teardown({ settings, directory: f.directory, github: f.github });
      expect(f.github.projects.has("FOREIGN")).toBe(true);
      expect(f.github.hooks.has(99)).toBe(true);
    } finally {
      await f.dispose();
    }
  });
  it("refuses a foreign issue with the seed title", async () => {
    const f = await fixture();
    try {
      await provision({ settings, directory: f.directory, github: f.github, files });
      const issue = [...f.github.issues.values()][0]!;
      issue.body = "An unrelated issue";
      await expect(
        provision({ settings, directory: f.directory, github: f.github, files }),
      ).rejects.toThrow("foreign issue");
      expect(f.github.issues.get(issue.node_id)?.body).toBe("An unrelated issue");
    } finally {
      await f.dispose();
    }
  });
  it("keeps an active hook URL while correcting its events", async () => {
    const f = await fixture();
    try {
      await provision({ settings, directory: f.directory, github: f.github, files });
      const hook = [...f.github.hooks.values()][0]!;
      const secret = hook.config.secret;
      hook.active = true;
      hook.config.url = "https://example.invalid/webhooks/github?owner-marker=test-owned";
      hook.events = ["issues"];
      await provision({ settings, directory: f.directory, github: f.github, files });
      expect(hook.active).toBe(true);
      expect(hook.config.url).toBe(
        "https://example.invalid/webhooks/github?owner-marker=test-owned",
      );
      expect(hook.config.secret).toBe(secret);
    } finally {
      await f.dispose();
    }
  });
});

it("a second teardown reports every resource absent", async () => {
  const f = await fixture();
  try {
    await provision({ settings, directory: f.directory, github: f.github, files });
    await teardown({ settings, directory: f.directory, github: f.github });
    const reported: string[] = [];
    await teardown({
      settings,
      directory: f.directory,
      github: f.github,
      report: (name, state) => reported.push(`${name}: ${state}`),
    });
    expect(reported).toEqual([
      "Hook: absent",
      "Fixture board: absent",
      "fixture-app: absent",
      "fixture-settings: absent",
    ]);
  } finally {
    await f.dispose();
  }
});
