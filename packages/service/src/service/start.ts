// ---
// relationships:
//   implements:
//     - service-assembly
//     - gate-runtime
// ---
import { openCapacity } from "../capacity/index.ts";
import type { Capacity } from "../capacity/index.ts";
import { openTaskMetadata, taskMetadataMigrationSteps } from "../task-metadata/index.ts";
import { startIntake, intakeMigrationSteps, intakeFailedHandler } from "../intake/index.ts";
import type { Intake } from "../intake/index.ts";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { loadServiceConfiguration } from "../service-configuration/index.ts";
import { configureBlueprintExpressions } from "../blueprint-expressions.ts";
import { openStore } from "../store/index.ts";
import type { Store } from "../store/index.ts";
import { openUsage, usageMigrationSteps } from "../usage/index.ts";
import { lintTokens, manifoldImplementationNames } from "@wyrd-company/manifold-shared";
import { createComparatorSandbox } from "../comparator-sandbox/index.ts";
import { createMirror } from "../github-source/mirror.ts";
import { githubSteps } from "../github-source/migrations.ts";
import { createGates, gatesMigrationSteps } from "../gates/index.ts";
import type { Gates } from "../gates/index.ts";
import { ledgerMigrationSteps } from "../ledger/index.ts";
import { openPortfolio, portfolioMigrationSteps } from "../portfolio/index.ts";
import { openProcessRepository } from "../process-repository/index.ts";
import { createBlueprintLoader } from "../blueprint-loader/index.ts";
import { openAgentThreads } from "../agent-threads/index.ts";
import type { AgentThreads } from "../agent-threads/index.ts";
import { serviceImplementations } from "../implementations.ts";
import {
  openEscalations,
  heldActorHandler,
  escalationImplementations,
  mountEscalations,
} from "../escalations/index.ts";
import type { Escalations } from "../escalations/index.ts";
import { startRouter } from "../router/index.ts";
import type { Router } from "../router/index.ts";
import { createServiceActorHost } from "../actor-host/service.ts";
import type { ActorHost } from "../actor-host/index.ts";
import { recordStateEntry, invocationOf } from "../actor-host/index.ts";
import { startGitHubSource } from "../github-source/index.ts";
import type { GitHubSource } from "../github-source/index.ts";
import { startT3CodeSource, readThreadProject } from "../t3code-source/index.ts";
import type { T3CodeSource } from "../t3code-source/index.ts";
import { createHttpHost } from "../http-host/index.ts";
import { openTasks } from "../tasks/index.ts";
import { mountConsole } from "../console/index.ts";
import type { HttpHost } from "../http-host/index.ts";
import { createRevisions } from "./revisions.ts";
import { stderrLog } from "./log.ts";
import { githubWebhookPath } from "./types.ts";
import type { Service, ServiceParts, ServiceStep, StartServiceOptions } from "./types.ts";
export async function startService(options: StartServiceOptions): Promise<Service> {
  const log = options.log ?? stderrLog;
  let capacity: Capacity | undefined;
  let store: Store | undefined;
  let router: Router | undefined;
  let escalations: Escalations | undefined;
  let actorHost: ActorHost | undefined;
  let gates: Gates | undefined;
  let github: GitHubSource | undefined;
  let t3code: T3CodeSource | undefined;
  let agentThreads: AgentThreads | undefined;
  let sourceStarted!: (source: T3CodeSource) => void;
  const sourceStarting = new Promise<T3CodeSource>((resolve) => {
    sourceStarted = resolve;
  });
  let githubStarted!: (source: GitHubSource) => void;
  const githubStarting = new Promise<GitHubSource>((resolve) => {
    githubStarted = resolve;
  });
  let http: HttpHost | undefined;
  let revisions: ReturnType<typeof createRevisions> | undefined;
  let intake: Intake | undefined;
  let stopping: Promise<void> | undefined;
  function step(name: ServiceStep, phase: "start" | "stop") {
    log({ level: "info", event: `${phase}-step`, message: name, detail: { step: name } });
    options.probes?.step?.(name);
    if (phase === "start") options.signal?.throwIfAborted();
  }
  function stop(): Promise<void> {
    stopping ??= (async () => {
      const errors: unknown[] = [];
      async function finish(name: ServiceStep, operation: () => void | Promise<void>) {
        try {
          await operation();
          step(name, "stop");
        } catch (error) {
          errors.push(error);
          log({ level: "error", event: "stop-failed", message: `Failed stop step: ${name}` });
        }
      }
      if (http) await finish("http-closed", () => http!.close());
      if (agentThreads) {
        try {
          await agentThreads.stop();
        } catch (error) {
          errors.push(error);
          log({
            level: "error",
            event: "stop-failed",
            message: "Failed stopping agent thread commands",
          });
        }
      }
      if (github || t3code)
        await finish("sources-stopped", async () => {
          const outcomes = await Promise.allSettled([github?.stop(), t3code?.stop()]);
          const failed = outcomes.find((outcome) => outcome.status === "rejected");
          if (failed?.status === "rejected") throw failed.reason;
        });
      if (escalations) await finish("escalations-stopped", () => escalations!.stop());
      if (revisions) await finish("revisions-idle", () => revisions!.close());
      if (intake) await finish("intake-stopped", () => intake!.stop());
      if (router) await finish("router-stopped", () => router!.stop());
      gates?.stop();
      capacity?.close();
      if (store) await finish("store-closed", () => store!.close());
      log({ level: "info", event: "stopped", message: "Service stopped" });
      if (errors.length) throw errors[0];
    })();
    return stopping;
  }
  try {
    options.signal?.throwIfAborted();
    const configuration = await loadServiceConfiguration(options.configurationFile);
    configureBlueprintExpressions(configuration.expressions);
    step("configuration-loaded", "start");
    await mkdir(dirname(configuration.store.file), { recursive: true });
    store = openStore({
      path: configuration.store.file,
      ...(options.probes?.delivery ? { probe: options.probes.delivery } : {}),
    });
    store.connection.migrate("metadata", taskMetadataMigrationSteps);
    store.connection.migrate("ledger", ledgerMigrationSteps);
    store.connection.migrate("portfolio", portfolioMigrationSteps);
    store.connection.migrate("usage", usageMigrationSteps);
    store.connection.migrate("intake", intakeMigrationSteps);
    store.connection.migrate("gates", gatesMigrationSteps);
    step("store-opened", "start");
    escalations = openEscalations({
      store,
      configuration: configuration.escalations,
      tokenFile: (name) => {
        const credential = configuration.credentials.resolve(name);
        if (credential.kind !== "ntfy-token")
          throw new TypeError("Requires an ntfy-token credential");
        return credential.tokenFile;
      },
      handlers: {
        "intake-failed": intakeFailedHandler(store, (id) => intake?.discovered([id])),
        "comparator-failed": (escalation) => gates?.comparatorFailed(escalation),
        "held-actor": heldActorHandler((actorId) => {
          const release = actorHost!.release(actorId);
          void Promise.resolve(release).catch(() =>
            log({
              level: "error",
              event: "actor-release-failed",
              message: "Held actor release failed",
              detail: { actorId },
            }),
          );
        }),
        "stranded-token": (escalation) =>
          (options.strandedTokenHandler ?? gates!.strandedToken)(escalation),
      },
      logger: {
        warn: (message) =>
          log({ level: "warn", event: "escalation-notification-warning", message }),
        error: (message) =>
          log({ level: "error", event: "escalation-notification-failed", message }),
      },
    });
    step("escalations-opened", "start");
    const basePortfolio = openPortfolio({ connection: store.connection });
    capacity = openCapacity({
      connection: store.connection,
      ledger: basePortfolio.ledger,
      accounts: () => usage.accounts(),
      credited: (credit) => {
        log({
          level: "info",
          event: "capacity-credited",
          message: "Account window credited",
          detail: credit,
        });
        options.probes?.capacityCredited?.(credit);
      },
      followUp: () => {
        usage.retryPending();
        gates?.inputChanged();
      },
    });
    const portfolio = { ...basePortfolio, ledger: capacity.ledger };
    step("portfolio-opened", "start");
    const usageConnection = store.connection;
    const usage = openUsage({
      connection: usageConnection,
      ledger: {
        postActual: (request) => {
          const result = portfolio.ledger.postActual(request);
          gates?.inputChanged();
          return result;
        },
        settle: (request) => {
          const result = portfolio.ledger.settle(request);
          gates?.inputChanged();
          return result;
        },
      },
      portfolio,
      threadProject: (environment, threadId) =>
        readThreadProject(usageConnection, environment, threadId),
      environments: new Set(Object.keys(configuration.environments)),
      onError: (error) =>
        log({
          level: "error",
          event: "usage-push-failed",
          message: error instanceof Error ? error.message : String(error),
        }),
    });
    const processRepository = await openProcessRepository({
      configuration: configuration.processRepository,
      credentials: configuration.credentials,
      ...(options.probes?.pull ? { probe: options.probes.pull } : {}),
    });
    const tokenFile = (name: string) => {
      const credential = configuration.credentials.resolve(name);
      if (credential.kind !== "t3code-token")
        throw new TypeError(`Credential ${name}: requires t3code-token`);
      return credential.tokenFile;
    };
    const commandLog = (level: "info" | "warn" | "error") => (message: string) =>
      log({ level, event: "agent-threads-log", message });
    agentThreads = openAgentThreads({
      environments: configuration.environments,
      tokenFile,
      actorOf: (id) => actorHost?.actorOf(id),
      invocationOf,
      bindingArchived: (project) =>
        portfolio.current().declaration.githubProjects.find((binding) => binding.name === project)
          ?.archived ?? false,
      revisionAt: processRepository.revisionAt,
      sourceReady: async (environment, signal) => {
        const source =
          t3code ??
          (await new Promise<T3CodeSource>((resolve, reject) => {
            if (signal?.aborted) {
              reject(signal.reason);
              return;
            }
            const aborted = () => reject(signal?.reason);
            signal?.addEventListener("abort", aborted, { once: true });
            void sourceStarting.then((source) => {
              signal?.removeEventListener("abort", aborted);
              resolve(source);
            });
          }));
        await source.ready(environment, signal);
      },
      sourceWrite: async (environment, thread, signal, send) => {
        signal.throwIfAborted();
        return t3code!.write(environment, thread, signal, send);
      },
      logger: {
        debug: commandLog("info"),
        info: commandLog("info"),
        warn: commandLog("warn"),
        error: commandLog("error"),
      },
    });
    const taskMetadata = openTaskMetadata({
      connection: store.connection,
      actorOf: (id) => actorHost?.actorOf(id),
      invocationOf,
      bindingOf: (project) =>
        portfolio
          .current()
          .declaration.githubProjects.find(
            (binding) =>
              binding.owner.toLowerCase() === project.owner.toLowerCase() &&
              binding.number === project.number,
          )?.name,
      source: (signal) => {
        if (signal.aborted) return Promise.reject(signal.reason);
        if (github) return Promise.resolve(github);
        return new Promise<GitHubSource>((resolve, reject) => {
          const aborted = () => reject(signal.reason);
          signal.addEventListener("abort", aborted, { once: true });
          void githubStarting.then((source) => {
            signal.removeEventListener("abort", aborted);
            resolve(source);
          });
        });
      },
    });
    const blueprints = createBlueprintLoader({
      implementations: serviceImplementations({
        escalations: escalationImplementations(escalations),
        agentThreads: agentThreads.implementations,
        taskMetadata: taskMetadata.implementations,
      }),
      onStateEntry: recordStateEntry,
      configurationBound: configuration.blueprintLint.configurationBound,
      revisionAt: processRepository.revisionAt,
      onExpressionError: (error, version) =>
        log({
          level: "error",
          event: "expression-error",
          message: error.message,
          detail: { commit: version.commit, path: version.path },
        }),
    });
    step("process-repository-opened", "start");
    const gateParts = {
      configuration,
      store,
      portfolio,
      processRepository,
      blueprints,
      log,
    };
    store.connection.migrate("github", githubSteps);
    const mirror = createMirror(store, Date.now);
    gates = options.gates
      ? await options.gates(gateParts)
      : createGates({
          store,
          portfolio,
          escalations,
          version: blueprints.version,
          revisionAt: processRepository.revisionAt,
          sandbox: await createComparatorSandbox(configuration.comparatorSandbox),
          lintTokens: (document) =>
            lintTokens(document, {
              names: manifoldImplementationNames,
              configurationBound: configuration.blueprintLint.configurationBound,
            }),
          trackedIssue: (nodeId) =>
            mirror.trackedIssue(
              nodeId,
              new Map(
                [...mirror.read().projects.values()]
                  .filter((row) =>
                    portfolio
                      .current()
                      .declaration.githubProjects.some(
                        (reference) =>
                          reference.owner.toLowerCase() === row.project.owner.toLowerCase() &&
                          reference.number === row.project.number,
                      ),
                  )
                  .map((row) => [row.project.nodeId, row.project]),
              ),
            ),
          onError: (error) => log({ level: "error", event: "gate-error", message: error.message }),
        });
    revisions = createRevisions({
      repository: processRepository,
      blueprints,
      portfolio,
      usage,
      taskMetadata,
      log,
      applied: (revision) => {
        intake?.revisionLoaded();
        options.probes?.applied?.(revision);
      },
      ...(gates ? { gates } : {}),
    });
    await revisions.follow();
    usage.retryPending();
    step("revision-followed", "start");
    try {
      await revisions.pull();
    } catch {
      log({ level: "error", event: "pull-failed", message: "Process repository pull failed" });
    }
    step("pulled", "start");
    await gates?.prepare();
    const beforeHost = {
      escalations,
      ...(gates ? { gates } : {}),
      configuration,
      agentThreads,
      store,
      portfolio,
      usage,
      processRepository,
      blueprints,
      revisions,
      log,
    };
    actorHost = await (options.actorHost ?? createServiceActorHost)(beforeHost);
    step("actor-host-opened", "start");
    const parts: ServiceParts = { ...beforeHost, actorHost };
    router = startRouter({
      store,
      host: actorHost,
      ...(gates ? { afterDrain: gates.afterDrain } : {}),
      onHeld: (held) => {
        log({
          level: "warn",
          event: "actor-held",
          message: held.reason,
          detail: { actorId: held.actorId },
        });
        escalations!.raise({
          kind: "held-actor",
          subject: { actorId: held.actorId },
          question: `Actor ${held.actorId} is held: ${held.reason}${held.row ? ` (event ${held.row.eventId})` : ""}`,
          choices: [
            { id: "retry", label: "Retry" },
            { id: "dismiss", label: "Dismiss" },
          ],
        });
      },
    });
    step("router-started", "start");
    escalations.start();
    step("escalations-started", "start");
    github = startGitHubSource({
      configuration: configuration.github,
      credentials: configuration.credentials,
      store,
      router,
      boundProjects: () =>
        portfolio
          .current()
          .declaration.githubProjects.map(({ owner, number }) => ({ owner, number })),
      processRepository: {
        url: configuration.processRepository.url,
        branch: configuration.processRepository.branch,
        pull: revisions.pull,
      },
      ...(options.probes?.cardMove ? { probeMove: options.probes.cardMove } : {}),
      onTracked: (ids) => intake?.discovered(ids),
      onMirrorChanged: () => {
        gates?.inputChanged();
        intake?.mirrorChanged();
      },
      onError: (error) =>
        log({
          level: "error",
          event: "github-error",
          message: error.message,
          detail: { kind: error.kind },
        }),
    });
    githubStarted(github);
    step("github-started", "start");
    intake = startIntake({
      escalations: parts.escalations,
      store: parts.store,
      tracked: github,
      blueprints: parts.blueprints,
      current: parts.revisions.current,
      actors: parts.actorHost,
      onFailed: (record) => {
        const failure = record.failure ?? record.startFailure!;
        parts.log({
          level: "warn",
          event: "intake-failed",
          message: failure.message,
          detail: { issueNodeId: record.issueNodeId, kind: failure.kind, detail: failure.detail },
        });
      },
      onError: (error) =>
        parts.log({
          level: "error",
          event: "intake-error",
          message: error.message,
          detail: { issueNodeId: error.issueNodeId, kind: error.kind },
        }),
    });
    step("intake-started", "start");
    const sourceLog = (level: "info" | "warn" | "error") => (message: string) =>
      log({ level, event: "t3code-log", message });
    t3code = startT3CodeSource({
      store,
      router,
      environments: configuration.environments,
      tokenFile,
      logger: {
        debug: sourceLog("info"),
        info: sourceLog("info"),
        warn: sourceLog("warn"),
        error: sourceLog("error"),
      },
    });
    sourceStarted(t3code);
    step("t3code-started", "start");
    http = createHttpHost({
      configuration: configuration.http,
      onError: (error, request) =>
        log({
          level: "error",
          event: "http-listener-error",
          message: error.message,
          detail: { ...request },
        }),
    });
    http.mount(githubWebhookPath, github.requestListener);
    mountConsole(http, {
      store: parts.store,
      log: (entry) =>
        parts.log({
          level: entry.level,
          event: "console-read-failed",
          message: entry.error,
          detail: { path: entry.path },
        }),
    });
    http.mount("/api/usage", parts.usage.listener);
    mountEscalations(http, parts.escalations);
    const tasks = openTasks({
      store: parts.store,
      held: (actorId) => Boolean(router!.held(actorId)),
      boundProjects: () =>
        portfolio
          .current()
          .declaration.githubProjects.filter((binding) => !binding.archived)
          .map((binding) => {
            const lifecycle = taskMetadata.current()?.projects[binding.name]?.lifecycle;
            return {
              binding: binding.name,
              owner: binding.owner,
              number: binding.number,
              item: binding.item,
              ...(lifecycle ? { lifecycle } : {}),
            };
          }),
      github,
      actorUsage: portfolio.ledger.actorUsage,
      listEscalations: escalations.list,
      thread: t3code.thread,
      tokenHolder: gates.tokenHolder,
      log: (entry) =>
        log({
          level: entry.level,
          event: "tasks-read-failed",
          message: entry.error,
          detail: { path: entry.path },
        }),
    });
    http.mount("/api/tasks", tasks.requestListener);
    const address = await http.listen();
    step("listening", "start");
    log({ level: "info", event: "started", message: "Service started", detail: address });
    return { ...parts, router, github, intake, t3code, http, stop };
  } catch (error) {
    await stop().catch(() => {});
    throw error;
  }
}
