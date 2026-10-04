// ---
// relationships:
//   implements: service-assembly
// ---
import type { Escalations, ServiceEscalationHandler } from "../escalations/index.ts";
import type { Intake, IntakeRevision, TaskActorStarter } from "../intake/index.ts";
import type { DeliveryProbe, JsonValue, Store } from "../store/index.ts";
import type { Router } from "../router/index.ts";
import type { ActorHost } from "../actor-host/index.ts";
import type { BlueprintLoader, RevisionLoad } from "../blueprint-loader/index.ts";
import type { Usage } from "../usage/index.ts";
import type { Portfolio } from "../portfolio/index.ts";
import type {
  ProcessRepository,
  PullOutcome,
  PullProbe,
  PullRequest,
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
  readonly actorHost?: (
    parts: Omit<ServiceParts, "actorHost">,
  ) => ServiceActorHost | Promise<ServiceActorHost>;
  /** Receives every log entry. Defaults to one JSON line per entry on stderr. */
  readonly log?: (entry: ServiceLogEntry) => void;
  readonly probes?: ServiceProbes;
  /** The gate runtime supplies the handler for returning stranded tokens. */
  readonly strandedTokenHandler?: ServiceEscalationHandler;
}

export interface ServiceProbes {
  /** Called after each start and stop step completes. */
  readonly step?: (step: ServiceStep) => void;
  /** Passed to the process repository. */
  readonly pull?: PullProbe;
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
  readonly escalations: Escalations;
  readonly actorHost: ServiceActorHost;
  readonly configuration: ServiceConfiguration;
  readonly store: Store;
  readonly portfolio: Portfolio;
  readonly usage: Usage;
  readonly processRepository: ProcessRepository;
  readonly blueprints: BlueprintLoader;
  readonly revisions: Revisions;
  readonly log: (entry: ServiceLogEntry) => void;
}

/** The start seam is supplied by the actor host when available. */
export type ServiceActorHost = ActorHost & Partial<TaskActorStarter>;

export interface Service extends ServiceParts {
  readonly intake: Intake;
  readonly router: Router;
  readonly github: GitHubSource;
  readonly t3code: T3CodeSource;
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
}

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
