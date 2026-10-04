// ---
// relationships:
//   verifies: service-configuration
// ---
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspect } from "node:util";
import { stringify } from "yaml";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { apiFixture } from "../process-repository/test-fixtures/remote.ts";
import { loadServiceConfiguration } from "./index.ts";
const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const close of cleanup.splice(0).toReversed()) await close();
});
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "credential-"));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  const api = await apiFixture();
  cleanup.push(() => api.close());
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  await writeFile(join(directory, "key.pem"), privateKey);
  const file = join(directory, "service.yml");
  await writeFile(
    file,
    stringify({
      processRepository: { url: "https://example.test/recipes.git", directory: "clone" },
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
  return {
    api,
    directory,
    privateKey,
    credential: (await loadServiceConfiguration(file)).credentials.resolve("example-app"),
  };
}
test("mints repository-scoped installation token and shares token cache across calls", async () => {
  const { api, credential, privateKey } = await setup();
  const options = { repositories: ["recipes"], permissions: { contents: "read" as const } };
  const token = await credential.installationToken(options);
  expect(token.reveal()).toBe(api.state.token);
  expect(api.calls).toEqual([
    {
      path: "/app/installations/2/access_tokens",
      body: { repositories: ["recipes"], permissions: { contents: "read" } },
    },
  ]);
  expect((await credential.installationToken(options)).reveal()).toBe(api.state.token);
  expect(api.calls).toHaveLength(1);
  expect(inspect(credential)).not.toContain(privateKey);
  expect(inspect(token)).not.toContain(api.state.token);
});
test("aborted stalled mint preserves abort reason and a subsequent healthy mint works", async () => {
  const { api, credential } = await setup();
  api.state.stall = true;
  const signal = AbortSignal.timeout(200);
  const error = await credential.installationToken({ signal }).catch((error) => error);
  expect(error).toBe(signal.reason);
  expect(signal.aborted).toBe(true);
  api.state.stall = false;
  expect((await credential.installationToken({})).reveal()).toBe(api.state.token);
});
test("failed mint discards GitHub response secrets and reports only name and status", async () => {
  const { api, credential, privateKey } = await setup();
  api.state.status = 403;
  const error = (await credential.installationToken({}).catch((error) => error)) as Error;
  expect(error.message).toBe("Credential example-app: GitHub status 403");
  expect(inspect(error)).not.toContain(api.state.token);
  expect(inspect(error)).not.toContain(privateKey);
});

test("shared token cache remints before installation token expiry", async () => {
  const { api, credential } = await setup();
  const now = Date.now();
  const clock = vi.spyOn(Date, "now").mockReturnValue(now);
  expect((await credential.installationToken({})).reveal()).toBe(api.state.token);
  api.state.token = "replacement-installation-token";
  clock.mockReturnValue(now + 58 * 60 * 1000);
  expect((await credential.installationToken({})).reveal()).toBe("generic-installation-token");
  expect(api.calls).toHaveLength(1);
  clock.mockReturnValue(now + 59 * 60 * 1000);
  expect((await credential.installationToken({})).reveal()).toBe("replacement-installation-token");
  expect(api.calls).toHaveLength(2);
});
