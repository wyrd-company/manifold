// ---
// relationships:
//   verifies: retention
// ---
import { startService } from "../../service/index.ts";
import { replayHost } from "./host.ts";
const service = await startService({
  configurationFile: process.argv[2]!,
  log: () => {},
  actorHost: () => replayHost(),
  probes: { retention: () => process.kill(process.pid, "SIGKILL") },
});
await service.retention.prune();
throw new Error("The crash probe did not run");
