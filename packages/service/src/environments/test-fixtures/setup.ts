// ---
// relationships:
//   verifies: [environment-control, service-assembly]
// ---
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { stringify } from "yaml";
import { serviceFixture } from "../../service/test-fixtures/repository.ts";
import { commandServer } from "../../agent-threads/test-fixtures/commands.ts";
export async function environmentFixture() {
  const f = await serviceFixture();
  const servers = await Promise.all([commandServer(), commandServer()]);
  const document = {
    machine: {
      initial: "opening",
      context: {},
      states: {
        opening: {
          invoke: {
            id: "opening",
            src: "thread-create",
            input: {
              type: "expression.map",
              params: {
                expression:
                  '{"project":"project","title":"Parcel sample","model":{"instanceId":"provider","model":"model"}}',
              },
            },
            onDone: { target: "waiting", actions: "follow-thread" },
            onError: "failed",
          },
        },
        waiting: {},
        failed: {},
        done: { type: "final" as const },
      },
    },
    schemas: {
      input: true,
      output: true,
      context: true,
      events: { "t3.turn.settled": true },
      actors: { "thread-create": { input: true, output: true } },
    },
  };
  const commit = await f.commit(60, {}, document);
  await writeFile(join(f.directory, "token"), "fixture-token");
  await writeFile(
    f.file,
    stringify({
      ...f.configuration,
      credentials: {
        ...f.configuration.credentials,
        writer: { kind: "t3code-token", tokenFile: "token" },
      },
      environments: Object.fromEntries(
        ["station", "depot"].map((name, index) => [
          name,
          {
            url: servers[index]!.url,
            credential: "writer",
            reconnect: { initialMs: 1, factor: 2, maxMs: 5, jitter: 0 },
          },
        ]),
      ),
    }),
  );
  return {
    ...f,
    servers,
    commit,
    async close() {
      await Promise.all(servers.map((s) => s.close()));
      await f.close();
    },
  };
}
