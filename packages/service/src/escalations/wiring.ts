// ---
// relationships:
//   implements: service-assembly
// ---
import { migrations as migrationsPart } from "../migrations/wiring.ts";
import { intakeFailedHandler } from "../intake/index.ts";
import {
  openEscalations,
  heldActorHandler,
  escalationImplementations,
  mountEscalations,
} from "./index.ts";
import type { HttpHost } from "../http-host/index.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
import type { Escalations } from "./index.ts";
import { intake as intakePart } from "../intake/wiring.ts";
import { gates as gatesPart } from "../gates/wiring.ts";
import { actorHost as actorHostPart } from "../actor-host/wiring.ts";
export const escalations = wiringPart({
  name: "escalations",
  start: (
    members: Required<Pick<Service, "store" | "configuration" | "agentTools" | "log">> & {
      http: HttpHost;
    },
    context,
  ): { escalations: Escalations } => {
    const { store, configuration, agentTools, http, log } = members;
    const { options } = context;
    const migrations = context.later(migrationsPart);
    const intake = context.later(intakePart);
    const gates = context.later(gatesPart);
    const actorHost = context.later(actorHostPart);
    const escalations = openEscalations({
      store,
      configuration: configuration.escalations,
      tokenFile: (name) => {
        const credential = configuration.credentials.resolve(name);
        if (credential.kind !== "ntfy-token")
          throw new TypeError("Requires an ntfy-token credential");
        return credential.tokenFile;
      },
      handlers: {
        "migration-failed": (escalation) => migrations.get().migrations.migrationFailed(escalation),
        "intake-failed": intakeFailedHandler(store, (id) =>
          intake.current()?.intake.discovered([id]),
        ),
        "comparator-failed": (escalation) => gates.current()?.gates.comparatorFailed(escalation),
        "agent-question": (question) => agentTools!.questionHandler(question),
        "held-actor": heldActorHandler((actorId) => {
          const release = actorHost.get().actorHost.release(actorId);
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
          (options.strandedTokenHandler ?? gates.get().gates.strandedToken)(escalation),
      },
      logger: {
        warn: (message) =>
          log({ level: "warn", event: "escalation-notification-warning", message }),
        error: (message) =>
          log({ level: "error", event: "escalation-notification-failed", message }),
      },
    });
    context.onStop("notifications", () => escalations.stop());
    context.addImplementations(escalationImplementations(escalations));
    mountEscalations(http, escalations);
    return { escalations };
  },
});

export const escalationsDelivery = wiringPart({
  name: "escalations-delivery",
  start: (members: Required<Pick<Service, "escalations">>): Record<never, never> => {
    const { escalations } = members;
    escalations.start();
    return {};
  },
});
