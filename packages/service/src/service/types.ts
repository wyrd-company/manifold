// ---
// relationships:
//   implements:
//     - service-assembly
//     - gate-runtime
// ---
import type { History } from "../history/index.ts";
import type { AgentThreadsOptions } from "../agent-threads/index.ts";
import type { Environments } from "../environments/index.ts";
import type { AgentTools } from "../agent-tools/index.ts";
import type { AgentThreads } from "../agent-threads/index.ts";
import type { Escalations, ServiceEscalationHandler } from "../escalations/index.ts";
import type { Intake, IntakeRevision } from "../intake/index.ts";
import type { DeliveryProbe, JsonValue, Store } from "../store/index.ts";
import type { Router } from "../router/index.ts";
import type { ActorHost } from "../actor-host/index.ts";
import type {
  BlueprintLoader,
  ImplementationRegistry,
  RevisionLoad,
} from "../blueprint-loader/index.ts";
import type { Usage } from "../usage/index.ts";
import type { Gates } from "../gates/index.ts";
import type { Portfolio } from "../portfolio/index.ts";
import type {
  ProcessRepository,
  PullOutcome,
  PullProbe,
  PullRequest,
  SaveRequest,
  SaveConflictFile,
  SaveProbe,
} from "../process-repository/index.ts";
import type { GitHubSource } from "../github-source/index.ts";
import type { T3CodeSource } from "../t3code-source/index.ts";
import type { HttpListener } from "../http-host/index.ts";
import type { ServiceConfiguration } from "../service-configuration/index.ts";

export interface StartServiceOptions {
  /** Path of the service configuration file. */
  readonly configurationFile: string;
  /** Aborting it stops the start at the next step boundary. */
  readonly signal?: AbortSignal;
  /** Builds the router's actor host from the parts started before the router. */
  readonly actorHost?: (parts: Omit<ServiceParts, "actorHost">) => ActorHost | Promise<ActorHost>;
  /** Builds gates before revision following. Defaults to the service gate runtime. */
  readonly gates?: (
    parts: Pick<
      ServiceParts,
      "configuration" | "store" | "portfolio" | "processRepository" | "blueprints" | "log"
    >,
  ) => Gates | Promise<Gates>;
  /** Receives every log entry. Defaults to one JSON line per entry on stderr. */
  readonly log?: (entry: ServiceLogEntry) => void;
  readonly probes?: ServiceProbes;
  /** The gate runtime supplies the handler for returning stranded tokens. */
  readonly strandedTokenHandler?: ServiceEscalationHandler;
}

export interface ServiceProbes {
  readonly sending?: AgentThreadsOptions["sending"];
  readonly retention?: (step: "actor-pruned", actorId: string) => void;
  readonly command?: AgentThreadsOptions["probe"];
  readonly migrated?: (step: "migrated", actorId: string) => void;
  readonly capacityCredited?: (credit: import("../capacity/index.ts").CapacityCredit) => void;
  /** Called after each start and stop step completes. */
  readonly step?: (step: ServiceStep) => void;
  readonly projectFieldWrite?: (
    write: import("../github-source/index.ts").ProjectFieldWrite,
  ) => void;
  readonly cardMove?: (move: import("../github-source/index.ts").CardMove) => void;
  /** Passed to the process repository. */
  readonly pull?: PullProbe;
  readonly save?: SaveProbe;
  /** Passed to the store. */
  readonly delivery?: DeliveryProbe;
  /** Called after the revision follower applies a revision. */
  readonly applied?: (applied: AppliedRevision) => void;
}

export type ServiceStep =
  | "configuration-loaded"
  | "store-opened"
  | "portfolio-opened"
  | "process-repository-opened"
  | "revision-followed"
  | "pulled"
  | "actor-host-opened"
  | "escalations-opened"
  | "escalations-started"
  | "escalations-stopped"
  | "router-started"
  | "github-started"
  | "intake-started"
  | "t3code-started"
  | "listening"
  | "http-closed"
  | "sources-stopped"
  | "revisions-idle"
  | "intake-stopped"
  | "router-stopped"
  | "store-closed";

export interface ServiceParts {
  readonly history: History;
  readonly gates?: Gates;
  readonly escalations: Escalations;
  readonly actorHost: ActorHost;
  readonly agentThreads: AgentThreads;
  readonly agentTools?: AgentTools;
  readonly configuration: ServiceConfiguration;
  readonly store: Store;
  readonly portfolio: Portfolio;
  readonly usage: Usage;
  readonly processRepository: ProcessRepository;
  readonly blueprints: BlueprintLoader;
  readonly revisions: Revisions;
  readonly log: (entry: ServiceLogEntry) => void;
}

export interface Service extends ServiceParts {
  readonly retention: import("../retention/index.ts").Retention;
  readonly migrations: import("../migrations/index.ts").Migrations;
  readonly intake: Intake;
  readonly router: Router;
  readonly github: GitHubSource;
  readonly t3code: T3CodeSource;
  readonly environments: Environments;
  readonly http: ServiceHttp;
  /** Stops the service; every call returns the first call's promise. */
  stop(): Promise<void>;
}

export interface Revisions {
  /** One publication after blueprint loading and portfolio application finish. */
  current(): IntakeRevision | undefined;
  /** The latest blueprint load, available before portfolio application finishes. */
  latest(): RevisionLoad | undefined;
  /** Queues a pull and the apply of its commit as one job; resolves after both. */
  pull(request?: PullRequest): Promise<PullOutcome>;
  /** Queues the apply of the current commit; resolves when it is applied. */
  follow(): Promise<void>;
  save(request: SaveRequest): Promise<SavedRevision>;
}

export type SavedRevision =
  | {
      readonly outcome: "saved" | "already-saved" | "unchanged";
      readonly commit: string;
      readonly blueprints: RevisionLoad | undefined;
    }
  | {
      readonly outcome: "conflict";
      readonly reason: "file-changed" | "branch-moved";
      readonly head: string;
      readonly files: readonly SaveConflictFile[];
    };

export interface AppliedRevision {
  readonly commit: string;
  readonly blueprints: RevisionLoad;
  readonly portfolio: "applied" | "unchanged" | "rejected";
  readonly usage: "applied" | "unchanged" | "rejected";
}

export interface ServiceHttp {
  mount(pathPrefix: string, listener: HttpListener): void;
  /** The address the host listens on. */
  address(): { readonly host: string; readonly port: number };
}

export interface ServiceLogEntry {
  readonly level: "info" | "warn" | "error";
  /** A kebab-case name of what happened, such as `pull-failed`. */
  readonly event: string;
  readonly message: string;
  readonly detail?: Readonly<Record<string, JsonValue>>;
}

/** The path the GitHub source's listener is mounted at. */
export const githubWebhookPath = "/webhooks/github";

export interface ServiceWiringPart<Needs extends object, Gives extends object> {
  /** Unique kebab-case name in the start list. */
  readonly name: string;
  /** Opens the module and returns only its new members. */
  readonly start: (members: Needs, context: ServiceWiringContext) => Gives | Promise<Gives>;
}
export interface ServiceWiringContext {
  readonly options: StartServiceOptions;
  /** Registers cleanup immediately after opening a resource. */
  onStop(stage: ServiceStopStage, stop: () => void | Promise<void>): void;
  /** Reads a part in this list after it starts. */
  later<Gives extends object>(part: ServiceWiringPart<never, Gives>): Later<Gives>;
  /** Registers blueprint implementations before blueprint-loader starts. */
  addImplementations(registry: ImplementationRegistry): void;
}
export interface Later<Gives extends object> {
  /** Undefined until the part starts. */
  current(): Gives | undefined;
  /** Throws by part name until the part starts. */
  get(): Gives;
  /** Waits for the part, or rejects with the abort reason. */
  ready(signal?: AbortSignal): Promise<Gives>;
}
export interface ServiceAssembly<Members extends object> {
  part<Gives extends object>(
    part: ServiceWiringPart<Members, Gives> & DistinctMembers<Members, Gives>,
  ): ServiceAssembly<Members & Gives>;
  step(step: ServiceStep): ServiceAssembly<Members>;
  start(): Promise<{ readonly members: Members; stop(): Promise<void> }>;
}
export type DistinctMembers<Members extends object, Gives extends object> = [
  Extract<keyof Gives, keyof Members>,
] extends [never]
  ? unknown
  : { readonly memberNameRepeated: Extract<keyof Gives, keyof Members> };
export type ServiceStopStage =
  | "requests"
  | "commands"
  | "sources"
  | "notifications"
  | "pulls"
  | "intake"
  | "delivery"
  | "timers"
  | "store";
