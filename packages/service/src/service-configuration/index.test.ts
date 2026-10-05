// ---
// relationships:
//   verifies: service-configuration
// ---
import { mkdtemp, writeFile, rm, chmod } from "node:fs/promises";
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
  store: { file: "state.sqlite" },
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
    commitAuthor: { name: "Manifold", email: "manifold@manifold.invalid" },
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
    ...minimal,
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
    ...minimal,
    processRepository: { ...minimal.processRepository, credential: "missing" },
  });
  await expect(loadServiceConfiguration(missing.file)).rejects.toMatchObject({
    issues: [
      { path: "/processRepository/credential", message: expect.stringContaining("missing") },
    ],
  });
  const { file, directory } = await config({
    ...minimal,
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
        ...minimal,
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
    ...minimal,
    processRepository: {
      ...minimal.processRepository,
      url: "https://example.test:invalid/recipes.git",
    },
  });
  await expect(loadServiceConfiguration(file)).rejects.toMatchObject({
    issues: [{ path: "/processRepository/url", message: "Invalid URL" }],
  });
});

test("an existing unreadable key fails configuration loading", async () => {
  const { file, directory } = await config({
    ...minimal,
    credentials: {
      "example-app": { kind: "github-app", appId: 1, installationId: 2, privateKeyFile: "key.pem" },
    },
  });
  const key = join(directory, "key.pem");
  await writeFile(key, "generic-test-key");
  await chmod(key, 0);
  try {
    await expect(loadServiceConfiguration(file)).rejects.toMatchObject({
      issues: [{ path: "/credentials/example-app/privateKeyFile", message: "EACCES" }],
    });
  } finally {
    await chmod(key, 0o600);
  }
});

test("loads the GitHub section with defaults and resolves hook secret paths", async () => {
  const defaults = await config(minimal);
  expect((await loadServiceConfiguration(defaults.file)).github).toEqual({
    apiUrl: "https://api.github.com",
    owners: {},
    sweepIntervalMs: 900000,
    redeliveryIntervalMs: 60000,
    requestTimeoutMs: 30000,
  });
  const { file, directory } = await config({
    ...minimal,
    credentials: {
      "example-app": { kind: "github-app", appId: 1, installationId: 2, privateKeyFile: "key.pem" },
    },
    github: {
      owners: {
        Example: { credential: "example-app", hooks: [{ id: 1, secretFile: "hook.secret" }] },
      },
      sweepIntervalMs: 12,
      redeliveryIntervalMs: 13,
      requestTimeoutMs: 14,
    },
  });
  await writeFile(join(directory, "key.pem"), "generic-key");
  await writeFile(join(directory, "hook.secret"), "generic-secret\n");
  const loaded = await loadServiceConfiguration(file);
  expect(loaded.github.owners["Example"]?.hooks[0]).toEqual({
    id: 1,
    repository: undefined,
    secretFile: join(directory, "hook.secret"),
  });
  expect(loaded.github).toMatchObject({
    sweepIntervalMs: 12,
    redeliveryIntervalMs: 13,
    requestTimeoutMs: 14,
  });
  expect(Object.isFrozen(loaded.github.owners["Example"]?.hooks)).toBe(true);
});

test("reports GitHub credential, secret file, repeated hook and owner paths", async () => {
  const { file } = await config({
    ...minimal,
    github: {
      owners: {
        Example: { credential: "missing", hooks: [{ id: 1, secretFile: "absent" }] },
        example: { credential: "missing", hooks: [{ id: 1, secretFile: "." }] },
      },
    },
  });
  await expect(loadServiceConfiguration(file)).rejects.toMatchObject({
    issues: expect.arrayContaining([
      { path: "/github/owners/Example/credential", message: expect.any(String) },
      { path: "/github/owners/Example/hooks/0/secretFile", message: expect.any(String) },
      { path: "/github/owners/example", message: expect.any(String) },
      { path: "/github/owners/example/hooks/0/id", message: expect.any(String) },
      { path: "/github/owners/example/hooks/0/secretFile", message: expect.any(String) },
    ]),
  });
});

test("reports the GitHub schema property and an unreadable hook secret", async () => {
  const invalid = await config({ ...minimal, github: { requestTimeoutMs: 0 } });
  await expect(loadServiceConfiguration(invalid.file)).rejects.toMatchObject({
    issues: [{ path: "/github/requestTimeoutMs", message: expect.any(String) }],
  });
  const { file, directory } = await config({
    ...minimal,
    credentials: {
      "example-app": { kind: "github-app", appId: 1, installationId: 2, privateKeyFile: "key.pem" },
    },
    github: {
      owners: {
        Example: { credential: "example-app", hooks: [{ id: 1, secretFile: "hook.secret" }] },
      },
    },
  });
  await writeFile(join(directory, "key.pem"), "generic-key");
  const secret = join(directory, "hook.secret");
  await writeFile(secret, "generic-secret");
  await chmod(secret, 0);
  try {
    await expect(loadServiceConfiguration(file)).rejects.toMatchObject({
      issues: [{ path: "/github/owners/Example/hooks/0/secretFile", message: "EACCES" }],
    });
  } finally {
    await chmod(secret, 0o600);
  }
});
test("loads environment defaults and a token file credential", async () => {
  const { directory, file } = await config({
    ...minimal,
    credentials: { reader: { kind: "t3code-token", tokenFile: "token" } },
    environments: { station: { url: "http://localhost:4321", credential: "reader" } },
  });
  await writeFile(join(directory, "token"), "fixture-token");
  const loaded = await loadServiceConfiguration(file);
  expect(loaded.environments["station"]).toEqual({
    url: "http://localhost:4321",
    credential: "reader",
    reconnect: { initialMs: 1000, factor: 2, maxMs: 30000, jitter: 0.2 },
    heartbeat: { intervalMs: 5000, missedPongLimit: 3 },
    openTimeoutMs: 10000,
  });
  expect(loaded.credentials.resolve("reader")).toEqual({
    kind: "t3code-token",
    name: "reader",
    tokenFile: join(directory, "token"),
  });
});
test("reports environment credential, URL and backoff contract failures", async () => {
  const { file } = await config({
    ...minimal,
    environments: {
      station: {
        url: "http://user:pass@example.test",
        credential: "absent",
        reconnect: { initialMs: 200, maxMs: 100 },
      },
    },
  });
  await expect(loadServiceConfiguration(file)).rejects.toMatchObject({
    issues: expect.arrayContaining([
      { path: "/environments/station/credential", message: expect.any(String) },
      { path: "/environments/station/url", message: expect.any(String) },
      { path: "/environments/station/reconnect/maxMs", message: expect.any(String) },
    ]),
  });
});
test("validates token file readability through the credential file dispatch", async () => {
  const { file } = await config({
    ...minimal,
    credentials: { reader: { kind: "t3code-token", tokenFile: "absent" } },
  });
  await expect(loadServiceConfiguration(file)).rejects.toMatchObject({
    issues: [{ path: "/credentials/reader/tokenFile", message: "ENOENT" }],
  });
});

test("loads HTTP defaults and the store path", async () => {
  const { file, directory } = await config({ ...minimal, store: { file: "data/state.sqlite" } });
  const loaded = await loadServiceConfiguration(file);
  expect(loaded.http).toEqual({ host: "127.0.0.1", port: 7480 });
  expect(loaded.store.file).toBe(join(directory, "data/state.sqlite"));
});
test.each([
  [{ processRepository: minimal.processRepository }, "/store"],
  [{ ...minimal, store: {} }, "/store/file"],
  [{ ...minimal, store: { file: "" } }, "/store/file"],
  [{ ...minimal, store: { file: "state", extra: true } }, "/store/extra"],
  [{ ...minimal, store: { file: "state" }, http: { port: -1 } }, "/http/port"],
  [{ ...minimal, store: { file: "state" }, http: { port: 65536 } }, "/http/port"],
  [{ ...minimal, store: { file: "state" }, http: { host: "" } }, "/http/host"],
  [{ ...minimal, store: { file: "state" }, http: { extra: true } }, "/http/extra"],
  [
    { ...minimal, store: { file: "state" }, http: { operatorCredential: "absent" } },
    "/http/operatorCredential",
  ],
])("reports assembly configuration boundary %j", async (value, path) => {
  const { file } = await config(value);
  await expect(loadServiceConfiguration(file)).rejects.toMatchObject({
    issues: expect.arrayContaining([{ path, message: expect.any(String) }]),
  });
});
test("rejects unknown credential kinds before reading credential files", async () => {
  const { file } = await config({
    ...minimal,
    credentials: { reader: { kind: "operator-token", tokenFile: "absent" } },
  });
  await expect(loadServiceConfiguration(file)).rejects.toMatchObject({
    issues: expect.arrayContaining([
      { path: "/credentials/reader/kind", message: "must be equal to one of the allowed values" },
    ]),
  });
});

test("blueprint lint bound defaults and rejects invalid bounds", async () => {
  const defaults = await config(minimal);
  expect((await loadServiceConfiguration(defaults.file)).blueprintLint).toEqual({
    configurationBound: 20000,
  });
  const custom = await config({ ...minimal, blueprintLint: { configurationBound: 3 } });
  expect((await loadServiceConfiguration(custom.file)).blueprintLint.configurationBound).toBe(3);
  for (const configurationBound of [0, -1, 1.5, "3"]) {
    const invalid = await config({ ...minimal, blueprintLint: { configurationBound } });
    await expect(loadServiceConfiguration(invalid.file)).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ path: "/blueprintLint/configurationBound" }),
      ]),
    });
  }
});

test("loads API-only escalation defaults and relative ntfy token paths", async () => {
  const { file, directory } = await config({
    ...minimal,
    escalations: {
      publicUrl: "https://example.test",
      destinations: {
        default: { topic: "opaque-topic", posture: "reserved", credential: "publisher" },
      },
    },
    credentials: { publisher: { kind: "ntfy-token", tokenFile: "token" } },
  });
  await writeFile(join(directory, "token"), "example-token");
  const loaded = await loadServiceConfiguration(file);
  expect(loaded.escalations).toEqual({
    publicUrl: "https://example.test",
    requestTimeoutMs: 30000,
    retryIntervalMs: 60000,
    destinations: {
      default: {
        server: "https://ntfy.sh",
        topic: "opaque-topic",
        posture: "reserved",
        credential: "publisher",
        priority: 4,
      },
    },
  });
  expect(loaded.credentials.resolve("publisher")).toEqual({
    kind: "ntfy-token",
    name: "publisher",
    tokenFile: join(directory, "token"),
  });
  const defaults = await config(minimal);
  expect((await loadServiceConfiguration(defaults.file)).escalations).toEqual({
    destinations: {},
    requestTimeoutMs: 30000,
    retryIntervalMs: 60000,
  });
});
test.each(["reserved", "self-hosted"])("posture %s requires a credential", async (posture) => {
  const { file } = await config({
    ...minimal,
    escalations: {
      publicUrl: "https://example.test",
      destinations: { default: { topic: "opaque-topic", posture } },
    },
  });
  await expect(loadServiceConfiguration(file)).rejects.toMatchObject({
    issues: [
      {
        path: "/escalations/destinations/default/credential",
        message: "Requires an ntfy-token credential",
      },
    ],
  });
});
test("destinations require a public URL and the correct credential kind", async () => {
  const missing = await config({
    ...minimal,
    escalations: { destinations: { default: { topic: "opaque-topic", posture: "open" } } },
  });
  await expect(loadServiceConfiguration(missing.file)).rejects.toMatchObject({
    issues: [
      { path: "/escalations/publicUrl", message: "Required with notification destinations" },
    ],
  });
  const wrong = await config({
    ...minimal,
    escalations: {
      publicUrl: "https://example.test",
      destinations: {
        default: { topic: "opaque-topic", posture: "open", credential: "publisher" },
      },
    },
    credentials: { publisher: { kind: "t3code-token", tokenFile: "token" } },
  });
  await writeFile(join(wrong.directory, "token"), "example-token");
  await expect(loadServiceConfiguration(wrong.file)).rejects.toMatchObject({
    issues: [
      {
        path: "/escalations/destinations/default/credential",
        message: "Requires an ntfy-token credential",
      },
    ],
  });
});

test("agent tool identification defaults and bounds are validated", async () => {
  const defaults = await config(minimal);
  expect((await loadServiceConfiguration(defaults.file)).agentTools).toEqual({
    identifyTimeoutMs: 3000,
  });
  for (const identifyTimeoutMs of [500, 5000, 30000]) {
    const valid = await config({ ...minimal, agentTools: { identifyTimeoutMs } });
    expect((await loadServiceConfiguration(valid.file)).agentTools.identifyTimeoutMs).toBe(
      identifyTimeoutMs,
    );
  }
  for (const identifyTimeoutMs of [499, 30001, 1.5, "3000"]) {
    const invalid = await config({ ...minimal, agentTools: { identifyTimeoutMs } });
    await expect(loadServiceConfiguration(invalid.file)).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ path: "/agentTools/identifyTimeoutMs" }),
      ]),
    });
  }
});

test("commit author defaults each identity part and rejects git identity delimiters", async () => {
  const { file } = await config({
    ...minimal,
    processRepository: { ...minimal.processRepository, commitAuthor: { name: "Example" } },
  });
  expect((await loadServiceConfiguration(file)).processRepository.commitAuthor).toEqual({
    name: "Example",
    email: "manifold@manifold.invalid",
  });
  for (const name of ["", "Example\nOther", "<Example>", "x".repeat(257)]) {
    const { file } = await config({
      ...minimal,
      processRepository: { ...minimal.processRepository, commitAuthor: { name } },
    });
    await expect(loadServiceConfiguration(file)).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ path: "/processRepository/commitAuthor/name" }),
      ]),
    });
  }
});
