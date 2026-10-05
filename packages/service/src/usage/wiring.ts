// ---
// relationships:
//   implements: service-assembly
// ---
import { openUsage } from "./index.ts";
import { readThreadProject } from "../t3code-source/index.ts";
import type { HttpHost } from "../http-host/index.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
import type { Usage } from "./index.ts";
import { gates as gatesPart } from "../gates/wiring.ts";
export const usage = wiringPart({
  name: "usage",
  start: (
    members: Required<Pick<Service, "store" | "portfolio" | "configuration" | "log">> & {
      http: HttpHost;
    },
    context,
  ): { usage: Usage } => {
    const { store, portfolio, configuration, http, log } = members;
    const gates = context.later(gatesPart);
    const usageConnection = store.connection;
    const usage = openUsage({
      connection: usageConnection,
      ledger: {
        actorUsage: portfolio.ledger.actorUsage,
        postActual: (request) => {
          const result = portfolio.ledger.postActual(request);
          gates.current()?.gates.inputChanged();
          return result;
        },
        settle: (request) => {
          const result = portfolio.ledger.settle(request);
          gates.current()?.gates.inputChanged();
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
    http.mount("/api/usage", usage.listener);
    return { usage };
  },
});
