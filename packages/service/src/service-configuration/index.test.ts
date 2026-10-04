// ---
// relationships:
//   verifies: service-configuration
// ---
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspect } from "node:util";
import { afterEach, expect, test } from "vite-plus/test";
import { stringify } from "yaml";
import {
  loadServiceConfiguration,
  ServiceConfigurationError,
  UnknownCredentialError,
  SecretValue,
} from "./index.ts";
import { comparatorSandboxDefaults } from "../comparator-sandbox/index.ts";
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function config(value: unknown) {
  const directory = await mkdtemp(join(tmpdir(), "configuration-"));
  directories.push(directory);
  const file = join(directory, "service.yml");
  await writeFile(file, typeof value === "string" ? value : stringify(value));
  return { directory, file };
}
const minimal = {
  processRepository: { url: "https://example.test/recipes.git", directory: "clone" },
};
test("loads defaults, freezes configuration and resolves relative paths", async () => {
  const { file, directory } = await config(minimal);
  const loaded = await loadServiceConfiguration(file);
  expect(loaded.processRepository).toEqual({
    ...minimal.processRepository,
    directory: join(directory, "clone"),
    branch: "main",
    credential: undefined,
    pullTimeoutMs: 60000,
  });
  expect(loaded.comparatorSandbox).toEqual(comparatorSandboxDefaults);
  expect(loaded.credentials.names).toEqual([]);
  expect(Object.isFrozen(loaded)).toBe(true);
  expect(Object.isFrozen(loaded.processRepository)).toBe(true);
  expect(() => loaded.credentials.resolve("missing")).toThrow(UnknownCredentialError);
  expect(() => loaded.credentials.resolve("missing")).toThrow("missing");
});
test("reports all schema paths including unknown and missing properties", async () => {
  const { file } = await config({
    processRepository: { directory: 1 },
    comparatorSandbox: { timeoutMs: 0 },
    extra: true,
  });
  const error = (await loadServiceConfiguration(file).catch(
    (error) => error,
  )) as ServiceConfigurationError;
  expect(error).toBeInstanceOf(ServiceConfigurationError);
  expect(error.issues.map((issue) => issue.path)).toEqual(
    expect.arrayContaining([
      "/extra",
      "/processRepository/url",
      "/processRepository/directory",
      "/comparatorSandbox/timeoutMs",
    ]),
  );
  const unknown = await config({
    processRepository: { ...minimal.processRepository, extra: true },
  });
  await expect(loadServiceConfiguration(unknown.file)).rejects.toMatchObject({
    issues: [{ path: "/processRepository/extra", message: expect.any(String) }],
  });
});
test("reports duplicate YAML keys with a line and unreadable files with their code", async () => {
  const { file } = await config("processRepository: {}\nprocessRepository: {}\n");
  await expect(loadServiceConfiguration(file)).rejects.toThrow(/line 2/i);
  await expect(loadServiceConfiguration(file + ".missing")).rejects.toThrow("ENOENT");
});
test("checks named credentials, cleartext authentication and readable key paths", async () => {
  const missing = await config({
    processRepository: { ...minimal.processRepository, credential: "missing" },
  });
  await expect(loadServiceConfiguration(missing.file)).rejects.toMatchObject({
    issues: [
      { path: "/processRepository/credential", message: expect.stringContaining("missing") },
    ],
  });
  const { file, directory } = await config({
    processRepository: {
      ...minimal.processRepository,
      url: "http://example.test/recipes.git",
      credential: "example-app",
    },
    credentials: {
      "example-app": { kind: "github-app", appId: 1, installationId: 2, privateKeyFile: "key.pem" },
    },
  });
  await expect(loadServiceConfiguration(file)).rejects.toMatchObject({
    issues: expect.arrayContaining([
      { path: "/processRepository/url", message: expect.any(String) },
      { path: "/credentials/example-app/privateKeyFile", message: expect.any(String) },
    ]),
  });
  await writeFile(join(directory, "key.pem"), "test-key");
  await writeFile(
    file,
    stringify({
      ...minimal,
      credentials: {
        "example-app": {
          kind: "github-app",
          appId: 1,
          installationId: 2,
          privateKeyFile: "key.pem",
        },
      },
    }),
  );
  expect((await loadServiceConfiguration(file)).credentials.resolve("example-app").kind).toBe(
    "github-app",
  );
});
test.each(["http", "https"])(
  "rejects %s user info without echoing credentials",
  async (protocol) => {
    for (const credential of [undefined, "missing"]) {
      const { file } = await config({
        processRepository: {
          ...minimal.processRepository,
          url: `${protocol}://generic-user:generic-password@example.test/recipes.git`,
          ...(credential ? { credential } : {}),
        },
      });
      const error = (await loadServiceConfiguration(file).catch(
        (error) => error,
      )) as ServiceConfigurationError;
      expect(error.issues.some((issue) => issue.path === "/processRepository/url")).toBe(true);
      expect(inspect(error)).not.toContain("generic-password");
      expect(inspect(error)).not.toContain("generic-user");
    }
  },
);
test.each(["Upper", "a".repeat(65), "a--b"])("rejects invalid declared name %s", async (name) => {
  const { file } = await config({
    ...minimal,
    credentials: {
      [name]: { kind: "github-app", appId: 1, installationId: 2, privateKeyFile: "key" },
    },
  });
  await expect(loadServiceConfiguration(file)).rejects.toBeInstanceOf(ServiceConfigurationError);
});
test("secret prints only its credential name through serialization and error inspection", () => {
  const value = new SecretValue("example-app", "generic-secret");
  expect(value.reveal()).toBe("generic-secret");
  for (const output of [
    String(value),
    JSON.stringify(value),
    inspect(value),
    inspect(new Error("failed", { cause: value })),
  ]) {
    expect(output).toContain("example-app");
    expect(output).not.toContain("generic-secret");
  }
});

test("a key path naming a directory fails configuration loading", async () => {
  const { file } = await config({
    ...minimal,
    credentials: {
      "example-app": { kind: "github-app", appId: 1, installationId: 2, privateKeyFile: "." },
    },
  });
  await expect(loadServiceConfiguration(file)).rejects.toMatchObject({
    issues: [{ path: "/credentials/example-app/privateKeyFile", message: expect.any(String) }],
  });
});

test("WHATWG URL validation rejects a malformed port at its path", async () => {
  const { file } = await config({
    processRepository: {
      ...minimal.processRepository,
      url: "https://example.test:invalid/recipes.git",
    },
  });
  await expect(loadServiceConfiguration(file)).rejects.toMatchObject({
    issues: [{ path: "/processRepository/url", message: "Invalid URL" }],
  });
});
