// ---
// relationships:
//   verifies: [environment-control, service-assembly]
// ---
import { startService } from "../../service/index.ts";
const file = process.argv[2]!;
const service = await startService({ configurationFile: file, log: () => {} });
if (process.argv[3] === "pause") service.environments.act("station", "pause");
if (!service.store.loadSnapshot("parcel")) {
  const loaded = await service.blueprints.version({
    commit: service.processRepository.current()!.commit,
    path: "blueprints/counter.yml",
  });
  if (loaded.status !== "loaded") throw new Error(JSON.stringify(loaded));
  service.actorHost.start({
    actorId: "parcel",
    blueprint: loaded.blueprint,
    input: { manifold: { environment: "station" } },
  });
}
process.send?.({ address: service.http.address() });
process.on("message", async (message) => {
  if (message === "stop") {
    await service.stop();
    process.disconnect?.();
  }
  if (message === "snapshot")
    process.send?.({ snapshot: service.store.loadSnapshot("parcel")?.snapshot });
});
