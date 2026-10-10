// ---
// relationships:
//   verifies: [github-event-source, task-metadata]
// ---
import { expect, test } from "vite-plus/test";
import { openStore } from "../store/index.ts";
import { startRouter } from "../router/index.ts";
import { startGitHubSource } from "../github-source/index.ts";
import { SecretValue } from "../service-configuration/index.ts";
import { githubFake } from "../github-source/test-fixtures/api.ts";
import { repositoryFixture } from "./test-fixtures/repository.ts";
import { taskFieldValues } from "../task-metadata/index.ts";
import type { ProjectMetadata } from "@wyrd-company/manifold-shared";
test("public GitHub source persists repository scopes, values and one attributed event through replay and restart", async () => {
  const fake = await githubFake();
  const h = await repositoryFixture();
  fake.addItem("IT_A", "I_A");
  const issue = fake.issues.get("I_A")!;
  Object.defineProperty(issue, "labels", {
    get: () =>
      h.assigned().map((name) => {
        const l = h.labels().find((l) => l.name === name)!;
        return { id: l.node_id, name: l.name };
      }),
  });
  const store = openStore({ path: ":memory:" });
  store.saveSnapshot({
    actorId: "parcel",
    machine: "record",
    snapshot: { status: "active", value: "waiting" },
  });
  const router = startRouter({
    store,
    host: {
      subscription: () => ({ topics: ["github"] }),
      restore: () => ({ status: "held", reason: "test" }),
    },
  });
  const metadata: ProjectMetadata = {
    lifecycle: { field: "Stage", options: ["Packed"] },
    repositories: ["sample/*"],
    fields: {
      size: {
        type: "single-select",
        storage: { kind: "label", prefix: "size: " },
        options: [{ name: "Small" }, { name: "Large" }],
        whenChanged: "revert",
      },
    },
  };
  const options = {
    store,
    router,
    configuration: {
      apiUrl: fake.url,
      owners: { sample: { credential: "example", hooks: [] } },
      sweepIntervalMs: 900000,
      redeliveryIntervalMs: 60000,
      requestTimeoutMs: 5000,
    },
    credentials: {
      names: ["example"],
      resolve: () => ({
        kind: "github-app" as const,
        name: "example",
        installationToken: async () => new SecretValue("example", "synthetic-token"),
      }),
    },
    boundProjects: () => [{ owner: "sample", number: 1 }],
    processRepository: {
      url: "https://example.test/process.git",
      branch: "main",
      pull: async () => ({ kind: "unchanged" as const, commit: "a".repeat(40) }),
    },
    storageAdapters: h.adapters,
    scopes: () => [{ kind: "repository" as const, repository: "sample/depot" }],
    taskFieldBinding: () => "parcels",
    taskFieldValues: (_id: string, issue: import("../github-source/index.ts").TrackedIssue) => {
      const values = taskFieldValues({
        metadata,
        project: { nodeId: "P_one", owner: "sample", number: 1 },
        issue,
        inScope: () => true,
      });
      return { size: { storage: "label" as const, value: values["size"]! } };
    },
  };
  let source = startGitHubSource(options);
  try {
    await expect.poll(() => source.trackedIssue("I_A")?.content?.labels.length).toBe(2);
    const scope = { kind: "repository" as const, repository: "sample/depot" };
    expect(await source.observeScope(scope)).toMatchObject({ status: "ready" });
    const write = { ...h.write, issueNodeId: "I_A" };
    await source.writeTaskField(write);
    await expect
      .poll(() => source.trackedIssue("I_A")?.content?.labels.map((l) => l.name))
      .toEqual(["personal", "size: Small"]);
    await source.writeTaskField(write);
    await source.stop();
    source = startGitHubSource(options);
    await source.writeTaskField(write);
    expect(source.scopeConfiguration(scope)).toMatchObject({
      status: "ready",
      labels: [{ nodeId: "L_small" }, {}, {}],
    });
    const events = store.connection.database
      .prepare("SELECT payload FROM store_inbox WHERE payload LIKE '%github.task-field.changed%'")
      .all()
      .map((row) => JSON.parse(row["payload"] as string));
    expect(events.filter((e) => e.to?.value === "Small")).toMatchObject([
      { binding: "parcels", field: "size", setBy: { actorId: "parcel", confirmed: true } },
    ]);
    expect(events.filter((e) => e.to?.value === "Small")).toHaveLength(1);
    expect(
      store.connection.database
        .prepare("SELECT count(*) AS count FROM github_task_field_write")
        .get()?.["count"],
    ).toBe(1);
  } finally {
    await source.stop();
    router.stop();
    store.close();
    await h.close();
    await fake.close();
  }
});
