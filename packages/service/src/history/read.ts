// ---
// relationships:
//   implements: actor-history
// ---
import type {
  ActorHistory,
  ActorCommand,
  StateValue,
  StateVisit,
} from "@wyrd-company/manifold-shared/actors-api";
import type { InboxRow, StoredSnapshot } from "../store/index.ts";
import { actorSummaries, leaves } from "../console/actors-api.ts";
import { parseBlueprintVersionKey } from "@wyrd-company/manifold-shared";
import type { VisitRow } from "./visits.ts";
export interface CommandRow {
  command_id: string;
  kind: ActorCommand["kind"];
  environment: string;
  thread_id: string | null;
  project_id: string | null;
  message_id: string | null;
  invoke_id: string;
  entry_id: string;
  sent_at: number;
  accepted_at: number | null;
}
const iso = (at: number) => new Date(at).toISOString();
export function assembleHistory(
  snapshot: StoredSnapshot,
  visits: VisitRow[],
  inbox: InboxRow[],
  links: Map<string, number>,
  commands: CommandRow[],
): ActorHistory {
  const actor = actorSummaries([snapshot])[0]!;
  return {
    actor,
    visits: visits.map(stateVisit),
    events: inbox.map((row) => ({
      eventId: row.eventId,
      type: (row.payload as { type: string }).type,
      topic: row.topic,
      payload: row.payload,
      receivedAt: iso(row.receivedAt),
      ...(row.consumedAt !== undefined ? { consumedAt: iso(row.consumedAt) } : {}),
      ...(links.has(row.eventId) ? { visit: links.get(row.eventId)! } : {}),
    })),
    commands: commands.map((row) => {
      const started =
        row.kind === "turn-start"
          ? inbox.find((event) => {
              const payload = event.payload as {
                type: string;
                threadId?: string;
                messageId?: string;
              };
              return (
                payload.type === "t3.turn.started" &&
                payload.threadId === row.thread_id &&
                payload.messageId === row.message_id
              );
            })
          : undefined;
      return {
        commandId: row.command_id,
        environment: row.environment,
        ...(row.kind === "project-create"
          ? { kind: row.kind, projectId: row.project_id! }
          : {
              kind: row.kind,
              threadId: row.thread_id!,
              ...(row.message_id !== null ? { messageId: row.message_id } : {}),
              ...(started ? { turnId: (started.payload as { turnId: string }).turnId } : {}),
            }),
        invokeId: row.invoke_id,
        entryId: row.entry_id,
        sentAt: iso(row.sent_at),
        ...(row.accepted_at !== null ? { acceptedAt: iso(row.accepted_at) } : {}),
      };
    }),
    ...(snapshot.snapshot.status === "done" || snapshot.snapshot.status === "stopped"
      ? {
          end: {
            status: snapshot.snapshot.status,
            endedAt: actor.savedAt,
            ...(snapshot.snapshot["output"] !== undefined
              ? { output: snapshot.snapshot["output"] as ActorHistory["events"][number]["payload"] }
              : {}),
          },
        }
      : {}),
  };
}

export function stateVisit(row: VisitRow): StateVisit {
  const value = JSON.parse(row.state_value) as StateValue;
  const version = parseBlueprintVersionKey(row.machine);
  return {
    visit: row.visit,
    value,
    states: leaves(value),
    machine: row.machine,
    ...(version ? { blueprint: { path: version.path, commit: version.commit } } : {}),
    enteredAt: iso(row.entered_at),
    ...(row.exited_at !== null ? { exitedAt: iso(row.exited_at) } : {}),
    ...(row.exit_event_type !== null
      ? {
          exitEvent: {
            type: row.exit_event_type,
            ...(row.exit_event_id !== null ? { eventId: row.exit_event_id } : {}),
          },
        }
      : {}),
  };
}
