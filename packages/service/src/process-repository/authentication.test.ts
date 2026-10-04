// ---
// relationships:
//   verifies: [process-repository, service-configuration]
// ---
import { generateKeyPairSync } from "node:crypto";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspect } from "node:util";
import { stringify } from "yaml";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { fixture, apiFixture } from "./test-fixtures/remote.ts";
import { openProcessRepository } from "./index.ts";
import {
  loadServiceConfiguration,
  UnknownCredentialError,
} from "../service-configuration/index.ts";
import { openStore } from "../store/index.ts";
const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const close of cleanup.splice(0).toReversed()) await close();
});
async function setup() {
  const directory = await fs.mkdtemp(join(tmpdir(), "authentication-"));
  cleanup.push(() => fs.rm(directory, { recursive: true, force: true }));
  const remote = await fixture(directory);
  cleanup.push(() => remote.close());
  const api = await apiFixture();
  cleanup.push(() => api.close());
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  await fs.writeFile(join(directory, "key.pem"), privateKey);
  const file = join(directory, "service.yml");
  await fs.writeFile(
    file,
    stringify({
      store: { file: "state.sqlite" },
      processRepository: {
        url: "https://example.test/recipes.git",
        credential: "example-app",
        directory: "clone",
        pullTimeoutMs: 200,
      },
      credentials: {
        "example-app": {
          kind: "github-app",
          appId: 1,
          installationId: 2,
          privateKeyFile: "key.pem",
          apiUrl: api.url,
        },
      },
    }),
  );
  const loaded = await loadServiceConfiguration(file);
  // The transport fixture uses loopback HTTP; configuration's HTTPS rule has separate coverage.
  const configuration = { ...loaded.processRepository, url: remote.url };
  return { directory, remote, api, privateKey, credentials: loaded.credentials, configuration };
}
test("stalled mint times out as remote, preserves prior revision and releases next pull", async () => {
  const { remote, api, configuration, credentials } = await setup();
  const a = await remote.commit("first");
  const repository = await openProcessRepository({ configuration, credentials });
  await repository.pull();
  expect(api.calls).toHaveLength(0);
  const b = await remote.commit("second");
  remote.state.auth = api.state.token;
  api.state.stall = true;
  await expect(repository.pull()).rejects.toMatchObject({
    kind: "remote",
    message: expect.stringContaining("timeout"),
  });
  expect(repository.current()!.commit).toBe(a);
  expect(await repository.current()!.read("recipes/a.txt")).toBe("first");
  expect(api.calls).toHaveLength(1);
  api.state.stall = false;
  expect(await repository.pull()).toMatchObject({ kind: "advanced", commit: b });
  expect(api.calls.at(-1)?.body).toEqual({
    repositories: ["recipes"],
    permissions: { contents: "read" },
  });
});
test("authentication token reaches git only and is absent from errors, logs, clone files and populated store rows", async () => {
  const { directory, remote, api, privateKey, configuration, credentials } = await setup();
  const log: unknown[][] = [];
  for (const method of ["log", "error", "warn", "info", "debug"] as const)
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      log.push(args);
    });
  const store = openStore({ path: join(directory, "store.sqlite") });
  cleanup.push(async () => store.close());
  store.saveSnapshot({
    actorId: "recipe-a",
    machine: "recipe",
    snapshot: { status: "active", value: "mixing", context: { quantity: 3 } },
  });
  store.writeInbox({ eventId: "event-a", topic: "recipe.add", payload: { amount: 2 } }, [
    "recipe-a",
  ]);
  const tables = store.connection.database
    .prepare("SELECT name FROM sqlite_schema WHERE type = 'table'")
    .all()
    .map((row) => String(row["name"]));
  const rows = () =>
    tables.map((name) =>
      store.connection.database.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`).all(),
    );
  const before = rows();
  remote.state.auth = api.state.token;
  await remote.commit("first");
  const repository = await openProcessRepository({ configuration, credentials });
  await repository.pull();
  expect(
    remote.requests.some(
      (request) =>
        request.authorization ===
        "Basic " + Buffer.from(`x-access-token:${api.state.token}`).toString("base64"),
    ),
  ).toBe(true);
  const missing = await openProcessRepository({
    configuration: { ...configuration, branch: "missing" },
    credentials,
  });
  const error = await missing.pull().catch((error) => error);
  expect(error).toMatchObject({ kind: "branch-missing" });
  expect(rows()).toEqual(before);
  const files = await fs.readdir(configuration.directory, { recursive: true, withFileTypes: true });
  const content = await Promise.all(
    files
      .filter((file) => file.isFile())
      .map((file) => fs.readFile(join(file.parentPath, file.name))),
  );
  const outputs = [
    inspect(error),
    inspect(log),
    inspect(rows()),
    ...content.map((buffer) => buffer.toString()),
  ];
  for (const output of outputs) {
    expect(output).not.toContain(api.state.token);
    expect(output).not.toContain(privateKey);
  }
  await expect(
    openProcessRepository({
      configuration: { ...configuration, credential: "missing" },
      credentials,
    }),
  ).rejects.toBeInstanceOf(UnknownCredentialError);
});
test("a refused minted token is authentication and preserves current", async () => {
  const { remote, api, configuration, credentials } = await setup();
  const a = await remote.commit("first");
  const repository = await openProcessRepository({ configuration, credentials });
  await repository.pull();
  remote.state.auth = api.state.token + "-other";
  await expect(repository.pull()).rejects.toMatchObject({ kind: "authentication" });
  expect(repository.current()!.commit).toBe(a);
});
