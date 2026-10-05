// ---
// relationships:
//   verifies: service-assembly
// ---
import { startService } from "../../service/index.ts";
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
