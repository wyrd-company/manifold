// ---
// relationships:
//   verifies: process-repository
// ---
import { openProcessRepository } from "../index.ts";
import type { ProcessRepositoryConfiguration } from "../../service-configuration/index.ts";
import type { SaveRequest } from "../index.ts";
const configuration = JSON.parse(process.argv[2]!) as ProcessRepositoryConfiguration;
const request = JSON.parse(process.argv[3]!) as SaveRequest;
const stop = process.argv[4];
const repository = await openProcessRepository({
  configuration,
  credentials: {
    names: [],
    resolve() {
      throw new Error("Not used");
    },
  },
  saveProbe(step) {
    if (step === stop) {
      process.send?.(step);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
    }
  },
});
await repository.pull();
await repository.save(request);
process.disconnect?.();
