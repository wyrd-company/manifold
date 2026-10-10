// ---
// relationships:
//   implements: service-assembly
// ---
import { mountConsole } from "./index.ts";
import type { HttpHost } from "../http-host/index.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
export const console = wiringPart({
  name: "console",
  start: (
    members: Required<Pick<Service, "store" | "log" | "history">> & { http: HttpHost },
  ): Record<never, never> => {
    const { http, store, log } = members;
    mountConsole(http, {
      store: store,
      history: members.history,
      log: (entry) =>
        log({
          level: entry.level,
          event: "console-read-failed",
          message: entry.error,
          detail: { path: entry.path },
        }),
    });
    return {};
  },
});
