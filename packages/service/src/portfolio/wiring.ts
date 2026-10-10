// ---
// relationships:
//   implements: service-assembly
// ---
import { openCapacity } from "../capacity/index.ts";
import { openPortfolio } from "./index.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
import type { Capacity } from "../capacity/index.ts";
import type { Portfolio } from "./index.ts";
import { usage as usagePart } from "../usage/wiring.ts";
import { t3codeSource } from "../t3code-source/wiring.ts";
import { gates as gatesPart } from "../gates/wiring.ts";
export const portfolio = wiringPart({
  name: "portfolio",
  start: (
    members: Required<Pick<Service, "store" | "log">>,
    context,
  ): { portfolio: Portfolio; capacity: Capacity } => {
    const { store, log } = members;
    const { options } = context;
    const usage = context.later(usagePart);
    const gates = context.later(gatesPart);
    const source = context.later(t3codeSource);
    const basePortfolio = openPortfolio({
      connection: store.connection,
      createdProjects: () => source.current()?.t3code.createdProjects() ?? [],
      createdProject: (project) =>
        source.current()?.t3code.createdProject(project.environment, project.id),
    });
    const capacity = openCapacity({
      connection: store.connection,
      ledger: basePortfolio.ledger,
      accounts: () => usage.get().usage.accounts(),
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
        usage.get().usage.retryPending();
        gates.current()?.gates.inputChanged();
      },
    });
    context.onStop("timers", () => capacity.close());
    const portfolio = { ...basePortfolio, ledger: capacity.ledger };
    return { portfolio, capacity };
  },
});
