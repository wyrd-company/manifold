// ---
// relationships:
//   verifies: process-repository
// ---
import { openProcessRepository } from "../index.ts";
import type { ProcessRepositoryConfiguration } from "../../service-configuration/index.ts";
const configuration = JSON.parse(process.argv[2]!) as ProcessRepositoryConfiguration;
const repository = await openProcessRepository({
  configuration,
  credentials: {
    names: [],
    resolve() {
      throw new Error("Not used");
    },
  },
  probe(step) {
    if (step === "fetched" && process.argv[3] === "fetched") {
      process.send?.("fetched");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
    }
  },
});
process.send?.("opened");
await repository.pull();
process.send?.("published");
process.disconnect?.();
