// ---
// relationships:
//   implements: live-github-environment
// ---
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { loadSettings, stateDirectory, readCredential, readApp, ensureState } from "./settings.ts";
import { GitHub } from "./github.ts";
import { provision, contentFiles } from "./provisioning.ts";
import { writeConfiguration } from "./configuration.ts";
async function main() {
  if (process.argv.length > 2) throw Error("live:provision takes no arguments; use CONTENT");
  const settings = await loadSettings(),
    directory = stateDirectory();
  await ensureState(directory);
  const github = new GitHub(
    settings.organization,
    await readCredential(settings.credentials.patFile),
  );
  await github.preflight();
  const app = await readApp(settings);
  const files = await contentFiles(
    process.env["CONTENT"]
      ? resolve(process.env["CONTENT"])
      : fileURLToPath(new URL("../content", import.meta.url)),
  );
  const resources = await provision({
    settings,
    directory,
    github,
    files,
    report: (resource, state) => console.log(`${resource}: ${state}`),
  });
  console.log(
    `Service configuration: ${(await writeConfiguration(settings, directory, resources, app)) ? "updated" : "present"}`,
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Provision failed");
  process.exitCode = 1;
});
