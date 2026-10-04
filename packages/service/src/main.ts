// ---
// relationships:
//   implements: service-assembly
// ---
import { startService } from "./service/index.ts";
import type { Service } from "./service/index.ts";
import { stderrLog } from "./service/log.ts";
const args = process.argv.slice(2);
if (args.length !== 1) {
  process.stderr.write("Usage: node dist/main.js <configuration-file>\n");
  process.exitCode = 2;
} else {
  const abort = new AbortController();
  let service: Service | undefined;
  let signalled = false;
  function signal() {
    if (signalled) return;
    signalled = true;
    if (!service) {
      abort.abort();
      stderrLog({ level: "info", event: "start-aborted", message: "Service startup interrupted" });
    } else {
      void service.stop().then(
        () => {
          process.exitCode = 0;
        },
        () => {
          process.exitCode = 1;
        },
      );
    }
  }
  process.on("SIGTERM", signal);
  process.on("SIGINT", signal);
  try {
    service = await startService({ configurationFile: args[0]!, signal: abort.signal });
  } catch (error) {
    if (abort.signal.aborted && error === abort.signal.reason) process.exitCode = 0;
    else {
      stderrLog({
        level: "error",
        event: "start-failed",
        message: error instanceof Error ? error.message : String(error),
      });
      process.exitCode = 1;
    }
  }
}
