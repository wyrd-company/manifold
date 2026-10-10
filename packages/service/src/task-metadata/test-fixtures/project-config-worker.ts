// ---
// relationships:
//   verifies: [task-metadata, service-assembly]
// ---
import { startService } from "../../service/index.ts";
let writes = 0;
const service = await startService({
  configurationFile: process.argv[2]!,
  log: () => {},
  probes: {
    projectFieldWrite() {
      if (process.argv[3] === "crash" && ++writes === 2) process.kill(process.pid, "SIGKILL");
    },
  },
});
process.send?.({ address: `http://${service.http.address().host}:${service.http.address().port}` });
process.on("message", (message) => {
  if (message === "stop") void service.stop().then(() => process.exit(0));
});
