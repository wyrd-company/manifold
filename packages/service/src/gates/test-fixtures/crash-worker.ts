// ---
// relationships:
//   verifies: gate-runtime
// ---
import { world } from "./world.ts";
const file = process.argv[2]!,
  point = process.argv[3]!;
const crash = () => process.kill(process.pid, "SIGKILL");
const running = await world(
  file,
  (step) => {
    if (step === point) crash();
  },
  (step) => {
    if (step === point) crash();
  },
);
running.close();
