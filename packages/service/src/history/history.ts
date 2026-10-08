// ---
// relationships:
//   implements: actor-history
// ---
import type { ActorHistory } from "@wyrd-company/manifold-shared/actors-api";
import type { Store } from "../store/index.ts";
import type { SaveHook } from "../actor-host/index.ts";
import type { SendingCommand, InvokedCommand } from "../agent-threads/index.ts";
import { historySteps } from "./migrations.ts";
import { visitChange } from "./visits.ts";
import type { VisitRow } from "./visits.ts";
import { assembleHistory } from "./read.ts";
import type { CommandRow } from "./read.ts";
export interface HistoryOptions {
  readonly store: Store;
  readonly log: (entry: {
    readonly level: "error";
    readonly event: "history-write-failed";
    readonly message: string;
    readonly detail: { readonly actorId: string; readonly commandId: string };
  }) => void;
  readonly now?: () => number;
}
export interface History {
  readonly saveHook: SaveHook;
  commandSending(command: SendingCommand): void;
  commandAccepted(command: InvokedCommand): void;
  read(actorId: string): ActorHistory | undefined;
}
interface Pending {
  command: SendingCommand;
  sentAt: number;
  acceptance?: { sequence: number; at: number };
}
export function openHistory({ store, log, now = Date.now }: HistoryOptions): History {
  const { connection } = store,
    { database: db } = connection;
  connection.migrate("history", historySteps);
  const pending = new Map<string, Pending>();
  const insert = db.prepare(
    "INSERT INTO history_command (command_id,actor_id,kind,invoke_id,entry_id,environment,thread_id,message_id,sent_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
  );
  const accept = db.prepare(
    "UPDATE history_command SET sequence=?,accepted_at=? WHERE command_id=? AND sequence IS NULL",
  );
  function apply(write: Pending) {
    const c = write.command;
    insert.run(
      c.commandId,
      c.invocation.actorId,
      c.implementation,
      c.invocation.invokeId,
      c.invocation.entryId,
      c.environment,
      c.threadId,
      c.messageId ?? null,
      write.sentAt,
    );
    if (write.acceptance) accept.run(write.acceptance.sequence, write.acceptance.at, c.commandId);
  }
  function probe(command: SendingCommand, acceptance?: Pending["acceptance"]) {
    const previous = pending.get(command.commandId);
    const write: Pending = {
      command,
      sentAt: previous?.sentAt ?? now(),
      ...(previous?.acceptance
        ? { acceptance: previous.acceptance }
        : acceptance
          ? { acceptance }
          : {}),
    };
    try {
      connection.transaction(() => {
        if (!previous) {
          const row = db
            .prepare("SELECT sent_at FROM history_command WHERE command_id=?")
            .get(command.commandId);
          if (row) write.sentAt = row["sent_at"] as number;
        }
        apply(write);
      });
      pending.delete(command.commandId);
    } catch (error) {
      pending.set(command.commandId, write);
      log({
        level: "error",
        event: "history-write-failed",
        message: error instanceof Error ? error.message : String(error),
        detail: { actorId: command.invocation.actorId, commandId: command.commandId },
      });
    }
  }
  return {
    commandSending: (command) => probe(command),
    commandAccepted: (command) => probe(command, { sequence: command.sequence, at: now() }),
    saveHook(save) {
      for (const [id, write] of pending) {
        if (write.command.invocation.actorId !== save.actorId) continue;
        const row = db
          .prepare("SELECT sent_at,sequence FROM history_command WHERE command_id=?")
          .get(id);
        if (
          row &&
          row["sent_at"] === write.sentAt &&
          (!write.acceptance || row["sequence"] === write.acceptance.sequence)
        )
          pending.delete(id);
        else apply(write);
      }
      const previous = db
        .prepare("SELECT * FROM history_visit WHERE actor_id=? ORDER BY visit DESC LIMIT 1")
        .get(save.actorId) as unknown as VisitRow | undefined;
      const change = visitChange(previous, save),
        at = now();
      if (save.eventId)
        db.prepare(
          "INSERT INTO history_event (actor_id,event_id,visit) VALUES (?,?,?) ON CONFLICT DO NOTHING",
        ).run(save.actorId, save.eventId, previous?.visit ?? null);
      let visit = change.visit;
      if (change.starts) {
        if (previous)
          db.prepare(
            "UPDATE history_visit SET exited_at=?,exit_event_type=?,exit_event_id=? WHERE actor_id=? AND visit=? AND exited_at IS NULL",
          ).run(
            at,
            save.changedBy?.type ?? null,
            save.changedBy?.eventId ?? null,
            save.actorId,
            previous.visit,
          );
        visit++;
        db.prepare(
          "INSERT INTO history_visit (actor_id,visit,machine,state_value,entered_at) VALUES (?,?,?,?,?)",
        ).run(save.actorId, visit, save.machine, change.value, at);
      }
      if (change.ends)
        db.prepare(
          "UPDATE history_visit SET exited_at=? WHERE actor_id=? AND visit=? AND exited_at IS NULL",
        ).run(at, save.actorId, visit);
    },
    read(actorId) {
      const snapshot = store.loadSnapshot(actorId);
      if (!snapshot) return undefined;
      const visits = db
        .prepare("SELECT * FROM history_visit WHERE actor_id=? ORDER BY visit")
        .all(actorId) as unknown as VisitRow[];
      const links = new Map(
        db
          .prepare(
            "SELECT event_id,visit FROM history_event WHERE actor_id=? AND visit IS NOT NULL",
          )
          .all(actorId)
          .map((row) => [row["event_id"] as string, row["visit"] as number]),
      );
      const commands = db
        .prepare("SELECT * FROM history_command WHERE actor_id=? ORDER BY sent_at,command_id")
        .all(actorId) as unknown as CommandRow[];
      return assembleHistory(snapshot, visits, store.actorInbox(actorId), links, commands);
    },
  };
}
