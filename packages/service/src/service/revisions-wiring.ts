// ---
// relationships:
//   implements: service-assembly
// ---
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
    const revisions = createRevisions({
      repository: processRepository,
      blueprints,
      portfolio,
      usage,
      taskMetadata,
      log,
      applied: (revision) => {
        intake.current()?.intake.revisionLoaded();
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
