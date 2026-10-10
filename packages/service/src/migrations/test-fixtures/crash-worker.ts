// ---
// relationships:
//   verifies: blueprint-migration
// ---
import { mock } from "node:test";
// Save and restart may outlast the declared deadline on a shared machine.
// Freeze only Date; transport timers and all I/O continue on the real clock.
mock.timers.enable({ apis: ["Date"], now: 1700000000000 });
const { startService } = await import("../../service/index.ts");
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
process.on("message", (message: { type: string; elapsed?: number }) => {
  if (message.type === "advance") {
    mock.timers.tick(message.elapsed!);
    service.router.persist("task:I_A");
  }
  if (message.type === "stop") void service.stop().then(() => process.exit(0));
});
