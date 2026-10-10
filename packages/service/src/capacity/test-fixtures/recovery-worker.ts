// ---
// relationships:
//   verifies: portfolio
// ---
import { writeSync } from "node:fs";
import { startService } from "../../service/index.ts";
const service = await startService({
  configurationFile: process.argv[2]!,
  log: () => {},
  probes: {
    capacityCredited() {
      writeSync(1, "credited\n");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
    },
  },
});
process.send?.(service.http.address());
