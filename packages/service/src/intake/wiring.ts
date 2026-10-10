// ---
// relationships:
//   implements: service-assembly
// ---
import type { TaskMetadata } from "../task-metadata/index.ts";
import { startIntake } from "./index.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
import type { Intake } from "./index.ts";
export const intake = wiringPart({
  name: "intake",
  start: (
    members: Required<
      Pick<
        Service,
        "escalations" | "store" | "github" | "blueprints" | "revisions" | "actorHost" | "log"
      >
    > & { taskMetadata: TaskMetadata },
    context,
  ): { intake: Intake } => {
    const { escalations, store, github, blueprints, revisions, actorHost, log } = members;
    const intake = startIntake({
      escalations: escalations,
      store: store,
      tracked: github,
      taskValues: (binding, issue) => members.taskMetadata.values(binding, issue),
      blueprints: blueprints,
      current: revisions.current,
      actors: actorHost,
      onFailed: (record) => {
        const failure = record.failure ?? record.startFailure!;
        log({
          level: "warn",
          event: "intake-failed",
          message: failure.message,
          detail: { issueNodeId: record.issueNodeId, kind: failure.kind, detail: failure.detail },
        });
      },
      onError: (error) =>
        log({
          level: "error",
          event: "intake-error",
          message: error.message,
          detail: { issueNodeId: error.issueNodeId, kind: error.kind },
        }),
    });
    context.onStop("intake", () => intake.stop());
    return { intake };
  },
});
