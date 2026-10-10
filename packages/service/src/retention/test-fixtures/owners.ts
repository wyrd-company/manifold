// ---
// relationships:
//   verifies: retention
// ---
import { startGitHubSource } from "../../github-source/index.ts";
import { startT3CodeSource } from "../../t3code-source/index.ts";
import { openAgentTools } from "../../agent-tools/index.ts";
import type { Store } from "../../store/index.ts";
import type { Router } from "../../router/index.ts";
import type { Escalations } from "../../escalations/index.ts";
export function owners(store: Store, router: Router, escalations: Escalations) {
  const github = startGitHubSource({
    store,
    router,
    configuration: {
      apiUrl: "https://example.invalid",
      owners: {},
      sweepIntervalMs: 900000,
      redeliveryIntervalMs: 60000,
      requestTimeoutMs: 30000,
    },
    credentials: {
      names: [],
      resolve: () => {
        throw new Error("No fixture credential");
      },
    },
    boundProjects: () => [],
    processRepository: {
      url: "https://example.invalid/process.git",
      branch: "main",
      pull: async () => ({ kind: "unchanged", commit: "a".repeat(40) }),
    },
  });
  const t3code = startT3CodeSource({ store, router, environments: {}, tokenFile: () => "" });
  const tools = openAgentTools({
    store,
    configuration: { identifyTimeoutMs: 500 },
    environments: new Set(),
    router: () => router,
    escalations: () => escalations,
    actors: () => ({
      followers: () => [],
      followedThreads: () => [],
      issueThreads: () => [],
      actorOf: () => undefined,
      eventSchema: () => ({ status: "undeclared" }),
    }),
    threads: {
      readThread: async () => {
        throw new Error("No fixture thread");
      },
      runningThreads: async () => [],
      startTurn: async () => {
        throw new Error("No fixture turn");
      },
    },
    sourceReady: () => false,
    trackedIssue: () => undefined,
    environmentId: async () => "fixture",
    log: () => {},
  });
  return {
    github,
    t3code,
    tools,
    close: async () => {
      await tools.stop();
      await t3code.stop();
      await github.stop();
    },
  };
}

export async function initializeOwners(store: Store) {
  const { startRouter } = await import("../../router/index.ts");
  const { openEscalations } = await import("../../escalations/index.ts");
  const router = startRouter({
    store,
    host: {
      subscription: () => ({ topics: [] }),
      restore: () => ({ status: "held", reason: "fixture" }),
    },
  });
  const escalations = openEscalations({
    store,
    configuration: { destinations: {}, requestTimeoutMs: 30000, retryIntervalMs: 60000 },
    handlers: {},
    tokenFile: () => "",
  });
  const owned = owners(store, router, escalations);
  await owned.close();
  router.stop();
  await escalations.stop();
}
