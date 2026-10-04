// ---
// relationships:
//   verifies: t3code-environment-source
// ---
import { openStore } from "../../store/index.ts";
import { startRouter } from "../../router/index.ts";
import { startT3CodeSource } from "../index.ts";
import type { EnvironmentsConfiguration } from "../index.ts";
const configuration = JSON.parse(process.argv[2]!) as {
  path: string;
  token: string;
  environments: EnvironmentsConfiguration;
  pause: boolean;
};
const store = openStore({ path: configuration.path });
const router = startRouter({
  store,
  host: {
    subscription: () => ({ topics: ["t3"] }),
    restore: () => ({ status: "held", reason: "fixture" }),
  },
});
const source = startT3CodeSource({
  store,
  router: {
    ...router,
    publish(event) {
      const result = router.publish(event);
      if (configuration.pause) {
        process.send?.("inside-transaction");
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
      }
      return result;
    },
  },
  environments: configuration.environments,
  tokenFile: () => configuration.token,
});
const timer = setInterval(() => {
  if (source.status()[0]?.state === "following" && source.status()[0]?.openSubscriptions === 0) {
    process.send?.("following");
    clearInterval(timer);
  }
}, 5);
process.on("message", async (message) => {
  if (message === "stop") {
    clearInterval(timer);
    await source.stop();
    router.stop();
    store.close();
    process.disconnect?.();
  }
});
