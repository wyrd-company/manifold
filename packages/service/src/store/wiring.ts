// ---
// relationships:
//   implements: service-assembly
// ---
import { taskMetadataMigrationSteps } from "../task-metadata/index.ts";
import { intakeMigrationSteps } from "../intake/index.ts";
import { bundleMigrationSteps } from "../bundle/index.ts";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { openStore } from "./index.ts";
import { usageMigrationSteps } from "../usage/index.ts";
import { gatesMigrationSteps } from "../gates/index.ts";
import { ledgerMigrationSteps } from "../ledger/index.ts";
import { portfolioMigrationSteps } from "../portfolio/index.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
import type { Store } from "./index.ts";
export const store = wiringPart({
  name: "store",
  start: async (
    members: Required<Pick<Service, "configuration">>,
    context,
  ): Promise<{ store: Store }> => {
    const { configuration } = members;
    const { options } = context;
    await mkdir(dirname(configuration.store.file), { recursive: true });
    const store = openStore({
      path: configuration.store.file,
      ...(options.probes?.delivery ? { probe: options.probes.delivery } : {}),
    });
    context.onStop("store", () => store.close());
    store.connection.migrate("metadata", taskMetadataMigrationSteps);
    store.connection.migrate("ledger", ledgerMigrationSteps);
    store.connection.migrate("portfolio", portfolioMigrationSteps);
    store.connection.migrate("usage", usageMigrationSteps);
    store.connection.migrate("intake", intakeMigrationSteps);
    store.connection.migrate("gates", gatesMigrationSteps);
    store.connection.migrate("bundle", bundleMigrationSteps);
    return { store };
  },
});
