// ---
// relationships:
//   verifies: default-process
// ---
import { startService } from "../service/index.ts";
const config = JSON.parse(process.argv[2]!) as { file: string };
const service = await startService({
  configurationFile: config.file,
  log: (entry) => process.send?.({ type: "log", entry }),
});
process.send?.({ type: "ready", address: service.http.address() });
process.on("message", (message) => {
  if (message === "stop") void service.stop().then(() => process.exit(0));
});
