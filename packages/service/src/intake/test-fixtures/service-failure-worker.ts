// ---
// relationships:
//   verifies: intake
// ---
import { setup, files, issue } from "./fixture.ts";
import { openEscalations } from "../../escalations/index.ts";
import { intakeFailedHandler } from "../index.ts";
const [path, step] = process.argv.slice(2);
if (!path) throw new Error("path required");
const expression =
  'task.fields.Track.name = "Gears" ? {"blueprint":"missing.yml"} : {"blueprint":"blueprints/parcel.yml"}';
const crash = () => process.kill(process.pid, "SIGKILL");
const s = await setup(path, files(expression), {
  probe(point) {
    if (step === "failed" && point === "failed") crash();
  },
});
s.intake.discovered(["I1"]);
await s.intake.idle();
if (step === "retry") {
  await s.escalations.stop();
  const questions = openEscalations({
    store: s.store,
    configuration: { destinations: {}, requestTimeoutMs: 30000, retryIntervalMs: 60000 },
    tokenFile: () => "",
    handlers: {
      "held-actor": () => {},
      "stranded-token": () => {},
      "comparator-failed": () => {},
      "intake-failed": intakeFailedHandler(s.store, crash),
    },
  });
  questions.answer(questions.list({ status: "open" })[0]!.id, { choice: "retry" }, "api");
}
if (step === "mirror" || step === "untracked") {
  const changed = issue();
  const value =
    step === "untracked"
      ? null
      : {
          ...changed,
          items: changed.items.map((item) => ({
            ...item,
            fields: { Track: { kind: "single-select", optionId: "paper", name: "Paper" } },
          })),
        };
  // The fake mirror commits before its callback, just as the source does.
  s.store.connection.transaction(() => {
    s.store.connection.database.exec("CREATE TABLE fixture_mirror (issue TEXT) STRICT");
    s.store.connection.database
      .prepare("INSERT INTO fixture_mirror VALUES (?)")
      .run(JSON.stringify(value));
  });
  crash();
}
throw new Error("fault point not reached");
