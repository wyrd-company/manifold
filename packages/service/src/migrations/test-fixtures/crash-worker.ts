// ---
// relationships:
//   verifies: blueprint-migration
// ---
import { startService } from "../../service/index.ts";
const [configurationFile, mode] = process.argv.slice(2);
const service = await startService({
  configurationFile: configurationFile!,
  log: (entry) => process.send?.({ type: "log", entry }),
  probes: {
    migrated() {
      if (mode === "kill") process.kill(process.pid, "SIGKILL");
    },
  },
});
process.send?.({ type: "ready", address: service.http.address() });
process.on("message", (message: { type: string }) => {
  if (message.type === "stop") void service.stop().then(() => process.exit(0));
});
