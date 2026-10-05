// ---
// relationships:
//   verifies: [task-metadata, service-assembly]
// ---
import { startService } from "../../service/index.ts";
const service = await startService({
  configurationFile: process.argv[2]!,
  log: (entry) => {
    if (entry.event === "blueprint-invalid") console.error(JSON.stringify(entry));
  },
  probes: {
    cardMove() {
      if (process.argv[3] === "crash") process.kill(process.pid, "SIGKILL");
    },
  },
});
process.send?.("ready");
process.on("message", (message) => {
  if (message === "start") {
    const blueprint = service.revisions.latest()!.blueprints.get("blueprints/counter.yml")!;
    service.actorHost.start({
      actorId: "parcel",
      blueprint,
      input: { manifold: { project: "P_one", issue: "I_A" } },
    });
  }
  if (message === "sweep") service.github.requestSweep();
  if (message === "stop") void service.stop().then(() => process.exit(0));
});
