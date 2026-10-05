// ---
// relationships:
//   implements: service-assembly
// ---
import { createHttpHost } from "./index.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
import type { HttpHost } from "./index.ts";
export const httpHost = wiringPart({
  name: "http-host",
  start: (members: Required<Pick<Service, "configuration" | "log">>): { http: HttpHost } => {
    const { configuration, log } = members;
    const http = createHttpHost({
      configuration: configuration.http,
      onError: (error, request) =>
        log({
          level: "error",
          event: "http-listener-error",
          message: error.message,
          detail: { ...request },
        }),
    });
    return { http };
  },
});

export const listen = wiringPart({
  name: "listen",
  start: async (members: { http: HttpHost }, context): Promise<Record<never, never>> => {
    const { http } = members;
    context.onStop("requests", () => http.close());
    await http.listen();
    return {};
  },
});
