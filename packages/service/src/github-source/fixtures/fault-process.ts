// ---
// relationships:
//   verifies: github-event-source
// ---
import { openStore } from "../../store/index.ts";
import { startRouter } from "../../router/index.ts";
import { startGitHubSource } from "../index.ts";
const [path, apiUrl, secretFile] = process.argv.slice(2) as [string, string, string];
const store = openStore({ path });
const router = startRouter({
  store,
  host: {
    subscription: (actor) => ({
      topics: [
        actor.actorId === "project" ? "github.project.P_one" : `github.issue.${actor.actorId}`,
      ],
    }),
    restore: () => ({ status: "held", reason: "fault test" }),
  },
});
startGitHubSource({
  store,
  router,
  configuration: {
    apiUrl,
    owners: {
      sample: { credential: "sample-token", hooks: [{ id: 1, repository: undefined, secretFile }] },
    },
    sweepIntervalMs: 900000,
    redeliveryIntervalMs: 60000,
    requestTimeoutMs: 30000,
  },
  credentials: {
    names: ["sample-token"],
    resolve: () => ({
      kind: "github-app",
      name: "sample-token",
      installationToken: async () => ({
        credential: "sample-token",
        reveal: () => "synthetic-token",
      }),
    }),
  },
  boundProjects: () => [{ owner: "sample", number: 1 }],
  processRepository: {
    url: "https://example.test/sample/process.git",
    branch: "main",
    pull: async () => ({ kind: "unchanged", commit: "a".repeat(40) }),
  },
  probe() {
    const pending = store.connection.database.prepare("SELECT kind FROM github_pending").all();
    if (
      pending.some((row) => row["kind"] === "issue") &&
      !pending.some((row) => row["kind"] === "project")
    )
      process.kill(process.pid, "SIGKILL");
  },
  onError() {
    process.exitCode = 1;
  },
});
