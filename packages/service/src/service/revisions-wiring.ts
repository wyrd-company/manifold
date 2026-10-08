// ---
// relationships:
//   implements: service-assembly
// ---
import { migrations as migrationsPart } from "../migrations/wiring.ts";
import { createRevisions } from "./revisions.ts";
import { openTaskMetadata } from "../task-metadata/index.ts";
import { wiringPart } from "./wiring.ts";
import type { Service } from "./types.ts";
import { intake as intakePart } from "../intake/wiring.ts";
export const revisions = wiringPart({
  name: "revisions",
  start: async (
    members: Required<
      Pick<Service, "processRepository" | "blueprints" | "portfolio" | "usage" | "gates" | "log">
    > & { taskMetadata: ReturnType<typeof openTaskMetadata> },
    context,
  ): Promise<{ revisions: ReturnType<typeof createRevisions> }> => {
    const { processRepository, blueprints, portfolio, usage, taskMetadata, gates, log } = members;
    const { options } = context;
    const intake = context.later(intakePart);
    const migrations = context.later(migrationsPart);
    const revisions = createRevisions({
      repository: processRepository,
      blueprints,
      portfolio,
      usage,
      taskMetadata,
      log,
      applied: (revision) => {
        intake.current()?.intake.revisionLoaded();
        void migrations
          .current()
          ?.migrations.pass()
          .catch((error) =>
            log({ level: "error", event: "migration-failed", message: String(error) }),
          );
        options.probes?.applied?.(revision);
      },
      ...(gates ? { gates } : {}),
    });
    context.onStop("pulls", () => revisions.close());
    await revisions.follow();
    usage.retryPending();
    return { revisions };
  },
});

export const pull = wiringPart({
  name: "pull",
  start: async (
    members: Required<Pick<Service, "revisions" | "log">>,
  ): Promise<Record<never, never>> => {
    const { revisions, log } = members;
    try {
      await revisions.pull();
    } catch {
      log({ level: "error", event: "pull-failed", message: "Process repository pull failed" });
    }
    return {};
  },
});
