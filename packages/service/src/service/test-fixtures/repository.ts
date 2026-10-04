// ---
// relationships:
//   verifies: service-assembly
// ---
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync } from "node:crypto";
import git from "isomorphic-git";
import type { BlueprintDocument } from "@wyrd-company/manifold-shared";
import { stringify } from "yaml";
import { fixture } from "../../process-repository/test-fixtures/remote.ts";
import { githubFake } from "../../github-source/test-fixtures/api.ts";
export async function serviceFixture() {
  const directory = await fs.mkdtemp(join(tmpdir(), "assembly-"));
  const remote = await fixture(directory);
  const api = await githubFake();
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  await fs.writeFile(
    join(directory, "key.pem"),
    privateKey.export({ type: "pkcs1", format: "pem" }),
  );
  await fs.writeFile(join(directory, "hook.secret"), "synthetic-secret");
  let previous: string | undefined;
  async function commit(
    guarantee: number,
    usageFiles: { accounts?: unknown; prices?: unknown; bindings?: unknown } = {},
    document?: BlueprintDocument,
  ) {
    async function blob(path: string, value: unknown) {
      return {
        path,
        mode: "100644",
        type: "blob" as const,
        oid: await git.writeBlob({
          fs,
          gitdir: remote.gitdir,
          blob: Buffer.from(stringify(value)),
        }),
      };
    }
    const blueprints = await git.writeTree({
      fs,
      gitdir: remote.gitdir,
      tree: [
        await blob(
          "counter.yml",
          document ?? {
            machine: {
              initial: "counting",
              context: { count: guarantee },
              states: { counting: {}, done: { type: "final" } },
            },
            schemas: { input: true, output: true, context: true, events: {} },
          },
        ),
      ],
    });
    const tree = await git.writeTree({
      fs,
      gitdir: remote.gitdir,
      tree: [
        { path: "blueprints", mode: "040000", type: "tree", oid: blueprints },
        await blob("portfolio.yml", {
          items: {
            alpha: { allocations: { acct: { guarantee } } },
            beta: { allocations: { acct: { guarantee: 100 - guarantee } } },
          },
        }),
        await blob("bindings.yml", usageFiles.bindings ?? {}),
        ...(usageFiles.accounts === undefined
          ? []
          : [await blob("accounts.yml", usageFiles.accounts)]),
        ...(usageFiles.prices === undefined ? [] : [await blob("prices.yml", usageFiles.prices)]),
      ],
    });
    const author = {
      name: "Example",
      email: "example@example.test",
      timestamp: 1700000000,
      timezoneOffset: 0,
    };
    previous = await git.writeCommit({
      fs,
      gitdir: remote.gitdir,
      commit: {
        tree,
        parent: previous ? [previous] : [],
        message: "Example declaration",
        author,
        committer: author,
      },
    });
    await remote.force(previous);
    return previous;
  }
  const first = await commit(60);
  const file = join(directory, "service.yml");
  const configuration = {
    store: { file: "data/state.sqlite" },
    processRepository: { url: remote.url, directory: "clone" },
    http: { port: 0 },
    credentials: {
      "api-reader": {
        kind: "github-app",
        appId: 1,
        installationId: 2,
        privateKeyFile: "key.pem",
        apiUrl: api.url,
      },
    },
    github: {
      apiUrl: api.url,
      owners: {
        sample: { credential: "api-reader", hooks: [{ id: 1, secretFile: "hook.secret" }] },
      },
    },
  };
  await fs.writeFile(file, stringify(configuration));
  return {
    directory,
    file,
    remote,
    api,
    first,
    commit,
    configuration,
    async close() {
      await api.close();
      await remote.close();
      await fs.rm(directory, { recursive: true, force: true });
    },
  };
}
