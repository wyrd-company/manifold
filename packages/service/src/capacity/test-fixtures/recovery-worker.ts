// ---
// relationships:
//   verifies: portfolio
// ---
import { writeSync } from "node:fs";
import type { startService as StartService } from "../../service/index.ts";
const { startService } = (await import(
  new URL("../../../dist/service/index.js", import.meta.url).href
)) as { startService: typeof StartService };
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
