// ---
// relationships:
//   verifies: blueprint-migration
// ---
import * as fs from "node:fs/promises";
import { join } from "node:path";
import git from "isomorphic-git";
import { parse, stringify } from "yaml";
import { serviceFixture } from "../../service/test-fixtures/repository.ts";
import { commandServer } from "../../agent-threads/test-fixtures/commands.ts";
export const parcel = {
  machine: {
    id: "parcel",
    initial: "waiting",
    context: { depot: "north" },
    states: { waiting: { on: { scanned: "delivered" } }, delivered: { type: "final" } },
  },
  schemas: {
    input: true,
    output: true,
    context: { type: "object", required: ["depot"], properties: { depot: { type: "string" } } },
    events: { scanned: true },
  },
};
export const changed = {
  ...parcel,
  machine: {
    ...parcel.machine,
    states: {
      waiting: {
        on: {
          scanned: {
            target: "delivered",
            guard: { type: "expression.guard", params: { expression: 'context.zone = "north"' } },
          },
        },
      },
      delivered: { type: "final" },
    },
  },
  schemas: {
    ...parcel.schemas,
    context: { type: "object", required: ["zone"], properties: { zone: { type: "string" } } },
  },
  migrations: [
    {
      from: parcel.schemas.context,
      context: { type: "expression.map", params: { expression: '{"zone": context.depot}' } },
    },
  ],
};
export async function migrationServiceFixture(document: Record<string, unknown> = parcel) {
  const f = await serviceFixture();
  const t3 = await commandServer();
  try {
    await git.setConfig({ fs, gitdir: f.remote.gitdir, path: "http.receivepack", value: true });
    const root = new URL("../../../../../examples/starter/", import.meta.url);
    const paths = [
      "manifold.yml",
      "portfolio.yml",
      "bindings.yml",
      "accounts.yml",
      "task-metadata.yml",
      "decision-models/intake.yml",
      "comparators/estimate.ts",
      "templates/task.njk",
    ];
    const files = new Map(
      await Promise.all(
        paths.map(async (path) => [path, await fs.readFile(new URL(path, root), "utf8")] as const),
      ),
    );
    const intake = parse(files.get("decision-models/intake.yml")!);
    intake.nodes[1].content.config.rules[0].blueprint = '"blueprints/parcel.yml"';
    files.set("decision-models/intake.yml", stringify(intake));
    const bindings = parse(files.get("bindings.yml")!);
    Object.assign(bindings.githubProjects["work-board"], {
      owner: "sample",
      t3codeProjects: ["project"],
    });
    files.set("bindings.yml", stringify(bindings));
    files.set("blueprints/parcel.yml", stringify(document));
    async function tree(prefix: string): Promise<string> {
      const names = [
        ...new Set(
          [...files.keys()]
            .filter((path) => path.startsWith(prefix))
            .map((path) => path.slice(prefix.length).split("/")[0]!),
        ),
      ].sort();
      return git.writeTree({
        fs,
        gitdir: f.remote.gitdir,
        tree: await Promise.all(
          names.map(async (name) => {
            const path = prefix + name;
            return files.has(path)
              ? {
                  path: name,
                  mode: "100644",
                  type: "blob" as const,
                  oid: await git.writeBlob({
                    fs,
                    gitdir: f.remote.gitdir,
                    blob: Buffer.from(files.get(path)!),
                  }),
                }
              : { path: name, mode: "040000", type: "tree" as const, oid: await tree(path + "/") };
          }),
        ),
      });
    }
    const author = {
      name: "Example",
      email: "example@example.test",
      timestamp: 1700000000,
      timezoneOffset: 0,
    };
    const commit = await git.writeCommit({
      fs,
      gitdir: f.remote.gitdir,
      commit: {
        tree: await tree(""),
        parent: [f.first],
        message: "Parcel process",
        author,
        committer: author,
      },
    });
    await f.remote.force(commit);
    await fs.writeFile(join(f.directory, "t3.token"), "fixture-token");
    await fs.writeFile(
      f.file,
      stringify({
        ...f.configuration,
        // Loaded migration saves also bind the starter comparator; 100 ms expires there.
        comparatorSandbox: { timeoutMs: 500 },
        credentials: {
          ...f.configuration.credentials,
          writer: { kind: "t3code-token", tokenFile: "t3.token" },
        },
        environments: { workstation: { url: t3.url, credential: "writer" } },
      }),
    );
    f.api.addItem("item-one", "I_A");
    return {
      ...f,
      t3,
      commit,
      close: async () => {
        await t3.close();
        await f.close();
      },
    };
  } catch (error) {
    await t3.close();
    await f.close();
    throw error;
  }
}
