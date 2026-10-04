// ---
// relationships:
//   implements: escalations
//   references: service-configuration
// ---
import type { RequestListener } from "node:http";
import type { Store } from "../store/index.ts";
import type { ServiceConfiguration } from "../service-configuration/index.ts";
import type { HeldActor } from "../router/index.ts";
import type { ImplementationRegistry } from "../blueprint-loader/index.ts";
import { openEscalations, heldActorHandler } from "./escalations.ts";
import type { Escalations, Invocation, ServiceEscalationHandler } from "./types.ts";
/** Structural assembly seam until service assembly and the actor host land. */
export interface EscalationsAssembly {
  readonly store: Store;
  readonly configuration: ServiceConfiguration;
  mount(pathPrefix: string, listener: RequestListener): void;
  mountOperator(pathPrefix: string, listener: RequestListener): void;
  readonly log: (entry: {
    readonly level: "warn" | "error";
    readonly event: string;
    readonly message: string;
  }) => void;
  readonly invocationOf: (args: unknown) => Invocation;
  readonly release: (actorId: string) => void;
  readonly strandedToken: ServiceEscalationHandler;
}
export function mountEscalations(parts: EscalationsAssembly) {
  const escalations = openEscalations({
    store: parts.store,
    configuration: parts.configuration.escalations,
    tokenFile: (name) => {
      const credential = parts.configuration.credentials.resolve(name);
      if (credential.kind !== "ntfy-token")
        throw new TypeError("Requires an ntfy-token credential");
      return credential.tokenFile;
    },
    invocationOf: parts.invocationOf,
    handlers: {
      "held-actor": heldActorHandler(parts.release),
      "stranded-token": parts.strandedToken,
    },
    logger: {
      warn: (message) =>
        parts.log({ level: "warn", event: "escalation-notification-warning", message }),
      error: (message) =>
        parts.log({ level: "error", event: "escalation-notification-failed", message }),
    },
  });
  parts.mount("/escalations", escalations.requestListener);
  parts.mountOperator("/api/escalations", escalations.apiListener);
  return {
    escalations,
    implementations: escalationImplementations(escalations),
    onHeld: (held: HeldActor) =>
      escalations.raise({
        kind: "held-actor",
        subject: { actorId: held.actorId },
        question: `Actor ${held.actorId} is held: ${held.reason}${held.row ? ` (event ${held.row.eventId})` : ""}`,
        choices: [
          { id: "retry", label: "Retry" },
          { id: "dismiss", label: "Dismiss" },
        ],
      }),
  };
}
export function escalationImplementations(escalations: Escalations): ImplementationRegistry {
  return { actors: { escalate: escalations.escalate }, actions: {}, guards: {}, delays: {} };
}
