// ---
// relationships:
//   verifies: default-process
// ---
import { startService } from "../service/index.ts";
const config = JSON.parse(process.argv[2]!) as { file: string; crash?: "event" | "command" };
const service = await startService({
  configurationFile: config.file,
  probes: {
    delivery: (step, row) => {
      if (
        config.crash === "event" &&
        step === "sent" &&
        (row.payload as { type: string }).type === "github.project-item.field-changed"
      ) {
        process.send?.({ type: "fault", boundary: "event", eventId: row.eventId });
        process.kill(process.pid, "SIGKILL");
      }
    },
    command: (command) => {
      if (config.crash === "command" && command.implementation === "turn-start") {
        process.send?.({ type: "fault", boundary: "command", commandId: command.commandId });
        process.kill(process.pid, "SIGKILL");
      }
    },
  },
  log: (entry) => process.send?.({ type: "log", entry }),
});
process.send?.({ type: "ready", address: service.http.address() });
process.on("message", (message) => {
  if (message === "stop") void service.stop().then(() => process.exit(0));
});
