// ---
// relationships:
//   verifies: [task-metadata, github-event-source]
// ---
import { memoryRevision, scopeKey } from "@wyrd-company/manifold-shared";
import { openStore } from "../../store/index.ts";
import { openTaskMetadata, taskMetadataMigrationSteps } from "../../task-metadata/index.ts";
import { SecretValue } from "../../service-configuration/index.ts";
import { createRepositoryFields } from "../index.ts";
import type { ScopeConfiguration, ProjectField } from "../../github-source/index.ts";
const [path, apiUrl, mode] = process.argv.slice(2);
const store = openStore({ path: path! });
store.connection.migrate("metadata", taskMetadataMigrationSteps);
const adapter = createRepositoryFields({
  configuration: {
    apiUrl: apiUrl!,
    owners: { sample: { credential: "example", hooks: [] } },
    requestTimeoutMs: 5000,
    sweepIntervalMs: 900000,
    redeliveryIntervalMs: 60000,
  },
  credentials: {
    names: ["example"],
    resolve: () => ({
      kind: "github-app",
      name: "example",
      installationToken: async () => new SecretValue("example", "synthetic-token"),
    }),
  },
});
const scopes = new Map<string, ScopeConfiguration>();
const project = { nodeId: "P_one", owner: "sample", number: 1 };
const fields: ProjectField[] = [
  {
    nodeId: "F_stage",
    name: "Stage",
    type: "single-select",
    options: [{ id: "O_packed", name: "Packed", color: "gray", description: "" }],
  },
];
let writes = 0;
const source = {
  project: () => project,
  projectByNumber: () => project,
  moveCard: async () => {},
  projectFields: () => ({ projectNodeId: "P_one", readAt: Date.now(), fields }),
  observeProjectFields: async () => ({ projectNodeId: "P_one", readAt: Date.now(), fields }),
  writeProjectField: async () => {
    throw new Error("Unexpected Project mutation");
  },
  scopeConfiguration: (scope: import("@wyrd-company/manifold-shared").StorageScope) =>
    scopes.get(scopeKey(scope)),
  observeScope: async (scope: import("@wyrd-company/manifold-shared").StorageScope) => {
    const observed = await adapter.observeScope(scope);
    scopes.set(scopeKey(scope), observed);
    return observed;
  },
  writeScopeEntity: async (write: import("../../github-source/index.ts").ScopeEntityWrite) => {
    const entity = await adapter.writeScopeEntity(write);
    if (mode === "crash" && ++writes === 2) process.kill(process.pid, "SIGKILL");
    return entity;
  },
};
const metadata = openTaskMetadata({
  connection: store.connection,
  actorOf: () => undefined,
  invocationOf: () => ({ actorId: "parcel", invokeId: "size", entryId: "entry" }),
  source: async () => source,
  bindingOf: () => "parcels",
  bindings: () => [
    {
      binding: "parcels",
      owner: "sample",
      number: 1,
      environment: "local",
      portfolioItem: "shipments",
    },
  ],
});
await metadata.apply(
  memoryRevision("a".repeat(40), {
    "bindings.yml":
      "githubProjects: {parcels: {owner: sample, number: 1, environment: local, item: shipments}}",
    "task-metadata.yml":
      "projects: {parcels: {lifecycle: {field: Stage, options: [Packed]}, repositories: [sample/warehouse], fields: {size: {type: single-select, storage: {kind: label, prefix: 'size: '}, options: [Small, Large]}, batch: {type: single-select, storage: {kind: milestone}, options: [Spring]}}}}",
  }),
);
const first = await metadata.projects.apply("parcels", { removeUndeclared: false });
const second = await metadata.projects.apply("parcels", { removeUndeclared: false });
process.send?.({ first, second });
await metadata.close();
adapter.stop();
store.close();
