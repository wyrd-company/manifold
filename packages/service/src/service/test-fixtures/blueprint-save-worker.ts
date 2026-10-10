// ---
// relationships:
//   verifies: service-assembly
// ---
import { startService } from "../index.ts";
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
