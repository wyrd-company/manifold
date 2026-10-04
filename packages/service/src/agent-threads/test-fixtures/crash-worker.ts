// ---
// relationships:
//   verifies: agent-threads
// ---
import { fixtureService } from "./service.ts";
import type { FixtureConfiguration } from "./service.ts";
const config = JSON.parse(process.argv[2]!) as FixtureConfiguration;
const service = fixtureService({
  ...config,
  onSave: (snapshot) =>
    process.send?.({
      value: snapshot.status === "error" ? "error" : snapshot.value,
      context: snapshot["context"],
    }),
  probe: (command) => process.send?.({ accepted: command.implementation }),
});
process.on("message", async (message) => {
  if (message === "stop") {
    await service.stop();
    process.disconnect?.();
  }
});
