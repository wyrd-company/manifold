// ---
// relationships:
//   implements: live-github-environment
// ---
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ensureState, stateDirectory } from "./settings.ts";
import { stopEnvironment } from "./supervisor.ts";
export async function runStop() {
  const directory = stateDirectory();
  await ensureState(directory);
  const outcome = await stopEnvironment(directory);
  if (outcome === "pending") {
    process.stderr.write("Environment shutdown pending; supervisor continues cleanup\n");
    process.exitCode = 1;
  } else process.stdout.write("Environment stopped\n");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  runStop().catch(() => {
    process.stderr.write("Environment stop failed\n");
    process.exitCode = 1;
  });
