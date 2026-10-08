// ---
// relationships:
//   implements: [blueprint-migration, service-assembly]
// ---
import { openMigrations } from "./index.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
import type { BundleSource } from "../blueprint-loader/index.ts";
export const migrations = wiringPart({
  name: "migrations",
  start: async (
    members: Required<
      Pick<
        Service,
        "store" | "actorHost" | "revisions" | "processRepository" | "escalations" | "log"
      >
    > & { bundles: BundleSource },
    context,
  ) => {
    const migrations = openMigrations({
      store: members.store,
      actorHost: members.actorHost,
      latest: members.revisions.latest,
      isAncestor: members.processRepository.isAncestor,
      bundles: members.bundles,
      escalations: members.escalations,
      log: members.log,
    });
    context.onStop("delivery", () => migrations.stop());
    await migrations.pass();
    return { migrations };
  },
});
