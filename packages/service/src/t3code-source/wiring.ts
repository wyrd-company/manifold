// ---
// relationships:
//   implements: service-assembly
// ---
import { startT3CodeSource } from "./index.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
import type { T3CodeSource } from "./index.ts";
export const t3codeSource = wiringPart({
  name: "t3code-source",
  start: (
    members: Required<Pick<Service, "store" | "router" | "configuration" | "agentTools" | "log">>,
    context,
  ): { t3code: T3CodeSource } => {
    const { store, router, configuration, agentTools, log } = members;
    const tokenFile = (name: string) => {
      const credential = configuration.credentials.resolve(name);
      if (credential.kind !== "t3code-token")
        throw new TypeError(`Credential ${name}: requires t3code-token`);
      return credential.tokenFile;
    };
    const sourceLog = (level: "info" | "warn" | "error") => (message: string) =>
      log({ level, event: "t3code-log", message });
    const t3code = startT3CodeSource({
      store,
      router,
      environments: configuration.environments,
      tokenFile,
      messagePlaced: agentTools.messagePlaced,
      logger: {
        debug: sourceLog("info"),
        info: sourceLog("info"),
        warn: sourceLog("warn"),
        error: sourceLog("error"),
      },
    });
    context.onStop("sources", () => t3code.stop());
    return { t3code };
  },
});
