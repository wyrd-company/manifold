// ---
// relationships:
//   verifies: [declarations-api, service-assembly]
// ---
import { startService } from "../../service/index.ts";
let armed = false;
const kill = () => process.kill(process.pid, "SIGKILL");
const service = await startService({
  configurationFile: process.argv[2]!,
  log: () => {},
  probes: {
    save(step) {
      if (armed && step === process.argv[3]) kill();
    },
    pull(step) {
      if (armed && process.argv[3] === "before" && step === "fetched") kill();
    },
    applied() {
      if (armed && process.argv[3] === "applied") kill();
    },
  },
});
armed = true;
process.send?.(service.http.address());
