// ---
// relationships:
//   verifies: gate-runtime
// ---
import { world } from "./world.ts";
const file = process.argv[2]!;
await world(
  file,
  (step) => {
    if (step === "comparator-failed") process.kill(process.pid, "SIGKILL");
  },
  undefined,
  'export default () => { throw new Error("bad order"); }',
);
throw new Error("fault point not reached");
