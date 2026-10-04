// ---
// relationships:
//   verifies: intake
// ---
import { setup, files } from "./fixture.ts";
import { fixtureHost } from "./fixture.ts";
const [path, step] = process.argv.slice(2);
if (!path) throw new Error("path required");
const s = await setup(path, files(), {
  probe(point) {
    if (step === "recorded" && point === "recorded") process.kill(process.pid, "SIGKILL");
  },
});
if (step === "snapshot") {
  await s.intake.stop();
  s.host.stop();
  const host = fixtureHost(s.store, s.versions, () => process.kill(process.pid, "SIGKILL"));
  const { startIntake } = await import("../index.ts");
  const intake = startIntake({
    store: s.store,
    tracked: {
      trackedIssue: (id) => s.tracked.get(id),
      trackedIssueIds: () => [...s.tracked.keys()],
    },
    blueprints: s.loader,
    current: s.current,
    actors: host.host,
  });
  await intake.idle();
} else {
  s.intake.discovered(["I1"]);
  await s.intake.idle();
}
throw new Error("fault point was not reached");
