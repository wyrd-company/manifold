// ---
// relationships:
//   verifies: service-assembly
// ---
import type { startService as StartService } from "../index.ts";
const { startService } = (await import(
  new URL("../../../dist/service/index.js", import.meta.url).href
)) as { startService: typeof StartService };
let starting = true;
const service = await startService({
  configurationFile: process.argv[2]!,
  log: () => {},
  probes: {
    pull(step) {
      if (!starting && step === "published") process.kill(process.pid, "SIGKILL");
    },
  },
});
starting = false;
process.send?.(service.http.address());
