// ---
// relationships:
//   implements: [portfolio-api, service-assembly]
// ---
import { mountPortfolioApi } from "./index.ts";
import type { HttpHost } from "../http-host/index.ts";
import type { ServiceParts } from "../service/index.ts";
import { mountDeclarationStandIn } from "./declarations-stand-in.ts";
// Structural ServiceWiringPart stand-in until 1171 and 1174 merge.
export const portfolioApiPart = {
  name: "portfolio-api",
  start(members: ServiceParts & { http: HttpHost }, _context: unknown) {
    mountDeclarationStandIn(members.http, members);
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
  },
};
