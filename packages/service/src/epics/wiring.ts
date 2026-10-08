// ---
// relationships:
//   implements: [service-assembly, epics-api]
// ---
import { openEpics } from "./index.ts";
import type { Tasks } from "../tasks/index.ts";
import type { Service } from "../service/types.ts";
import type { HttpHost } from "../http-host/index.ts";
import { wiringPart } from "../service/wiring.ts";
export const epics = wiringPart({
  name: "epics",
  start: ({
    github,
    tasks,
    http,
    log,
  }: Pick<Service, "github" | "log"> & { tasks: Tasks; http: HttpHost }) => {
    const epics = openEpics({
      github,
      tasks,
      log: (entry) =>
        log({
          level: "error",
          event: "epics-read-failed",
          message: entry.error,
          detail: { path: entry.path },
        }),
    });
    http.mount("/api/epics", epics.requestListener);
    return {};
  },
});
