// ---
// relationships:
//   implements: [portfolio-api, service-assembly]
// ---
import { mountPortfolioApi } from "./index.ts";
import type { HttpHost } from "../http-host/index.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
export const portfolioApiPart = wiringPart({
  name: "portfolio-api",
  start: (
    members: Required<
      Pick<Service, "portfolio" | "usage" | "processRepository" | "store" | "log">
    > & {
      http: HttpHost;
    },
  ): Record<never, never> => {
    mountPortfolioApi(members.http, {
      portfolio: members.portfolio,
      accounts: () => members.usage.accounts(),
      processRepository: members.processRepository,
      store: members.store,
      log: (entry) =>
        members.log({
          level: "error",
          event: "portfolio-read-failed",
          message: entry.error,
          detail: { path: entry.path },
        }),
    });
    return {};
  },
});
