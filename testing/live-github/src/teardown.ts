// ---
// relationships:
//   implements: live-github-environment
// ---
import { loadSettings, stateDirectory, readCredential, ensureState } from "./settings.ts";
import { GitHub } from "./github.ts";
import { teardown } from "./provisioning.ts";
import { withRecoveryLease } from "./supervisor.ts";
async function main() {
  if (process.argv.length > 2) throw Error("live:teardown takes no arguments");
  const settings = await loadSettings(),
    directory = stateDirectory();
  await ensureState(directory);
  await withRecoveryLease(directory, async () => {
    const github = new GitHub(
      settings.organization,
      await readCredential(settings.credentials.patFile),
    );
    await github.preflight(true);
    await teardown({
      settings,
      directory,
      github,
      report: (resource, state) => console.log(`${resource}: ${state}`),
    });
  });
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Teardown failed");
  process.exitCode = 1;
});
