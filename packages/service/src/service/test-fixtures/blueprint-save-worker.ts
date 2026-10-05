// ---
// relationships:
//   verifies: service-assembly
// ---
import type { startService as StartService } from "../index.ts";
const { startService } = (await import(
  new URL("../../../dist/service/index.js", import.meta.url).href
)) as { startService: typeof StartService };
const service = await startService({
  configurationFile: process.argv[2]!,
  log: () => {},
  probes: {
    save(step) {
      if (step === process.argv[3]) process.kill(process.pid, "SIGKILL");
    },
  },
});
process.send?.(service.http.address());
