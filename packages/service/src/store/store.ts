// ---
// relationships:
//   implements: store
// ---
import type { SQLOutputValue } from "node:sqlite";
import { openConnection } from "./connection.ts";
import { storeSteps } from "./migrations.ts";
import { statePaths } from "./state-paths.ts";
import type {
  DeadlineRow,
  InboxRow,
  PersistedSnapshot,
  Store,
  StoreOptions,
  StoredSnapshot,
} from "./types.ts";

type Row = Record<string, SQLOutputValue>;
function readSnapshot(row: Row): StoredSnapshot {
  return {
    actorId: row["actor_id"] as string,
    machine: row["machine"] as string,
    snapshot: JSON.parse(row["snapshot"] as string) as PersistedSnapshot,
    savedAt: row["saved_at"] as number,
  };
}
function readInbox(row: Row): InboxRow {
  return {
    sequence: row["sequence"] as number,
    eventId: row["event_id"] as string,
    actorId: row["actor_id"] as string,
    topic: row["topic"] as string,
    payload: JSON.parse(row["payload"] as string) as InboxRow["payload"],
    receivedAt: row["received_at"] as number,
    consumedAt: row["consumed_at"] === null ? undefined : (row["consumed_at"] as number),
  };
}
function readDeadline(row: Row): DeadlineRow {
  return {
    deadlineId: row["deadline_id"] as number,
    actorId: row["actor_id"] as string,
    statePath: row["state_path"] as string,
    eventName: row["event_name"] as string,
    fireAt: row["fire_at"] as number,
    entryId: row["entry_id"] as string,
    firedAt: row["fired_at"] === null ? undefined : (row["fired_at"] as number),
  };
}

export function openStore({ path, now = Date.now, probe }: StoreOptions): Store {
  const connection = openConnection(path);
  const { database } = connection;
  try {
    connection.migrate("store", storeSteps);
  } catch (error) {
    database.close();
    throw error;
  }
  const store: Store = {
    now,
    connection,
    saveSnapshot(write) {
      return connection.transaction(() => {
        const { actorId, machine, snapshot } = write;
        if (snapshot.status === "error") {
          database
            .prepare(
              "INSERT INTO store_errored_snapshot (actor_id, machine, snapshot, event_id, saved_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (actor_id) DO UPDATE SET machine=excluded.machine, snapshot=excluded.snapshot, event_id=excluded.event_id, saved_at=excluded.saved_at",
            )
            .run(actorId, machine, JSON.stringify(snapshot), write.eventId ?? null, now());
          return "errored";
        }
        const paths = statePaths(snapshot.value);
        for (const deadline of write.deadlines ?? [])
          if (deadline.statePath !== "" && !paths.includes(deadline.statePath))
            throw new RangeError(`Deadline state ${deadline.statePath} is not active`);
        database
          .prepare(
            "INSERT INTO store_snapshot (actor_id, machine, status, snapshot, saved_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (actor_id) DO UPDATE SET machine=excluded.machine, status=excluded.status, snapshot=excluded.snapshot, saved_at=excluded.saved_at",
          )
          .run(actorId, machine, snapshot.status, JSON.stringify(snapshot), now());
        database.prepare("DELETE FROM store_snapshot_state WHERE actor_id = ?").run(actorId);
        const insertState = database.prepare("INSERT INTO store_snapshot_state VALUES (?, ?, ?)");
        for (const path of paths) insertState.run(actorId, machine, path);
        const arms = new Set(
          (write.deadlines ?? []).map((arm) =>
            JSON.stringify([arm.statePath, arm.eventName, arm.entryId]),
          ),
        );
        for (const row of database
          .prepare("SELECT * FROM store_deadline WHERE actor_id = ?")
          .all(actorId)) {
          const deadline = readDeadline(row);
          if (!arms.has(JSON.stringify([deadline.statePath, deadline.eventName, deadline.entryId])))
            database
              .prepare("DELETE FROM store_deadline WHERE deadline_id = ?")
              .run(deadline.deadlineId);
        }
        for (const deadline of write.deadlines ?? []) {
          database
            .prepare(
              "DELETE FROM store_deadline WHERE actor_id = ? AND state_path = ? AND event_name = ? AND entry_id != ?",
            )
            .run(actorId, deadline.statePath, deadline.eventName, deadline.entryId);
          database
            .prepare(
              "INSERT INTO store_deadline (actor_id, state_path, event_name, fire_at, entry_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT (actor_id, state_path, event_name) DO NOTHING",
            )
            .run(
              actorId,
              deadline.statePath,
              deadline.eventName,
              deadline.fireAt,
              deadline.entryId,
            );
        }
        return "saved";
      });
    },
    activeSnapshots() {
      return database
        .prepare("SELECT * FROM store_snapshot WHERE status = 'active' ORDER BY actor_id")
        .all()
        .map(readSnapshot);
    },
    endedSnapshots() {
      return database
        .prepare(
          "SELECT * FROM store_snapshot WHERE status IN ('done', 'stopped') ORDER BY actor_id",
        )
        .all()
        .map(readSnapshot);
    },
    loadSnapshot(actorId) {
      const row = database.prepare("SELECT * FROM store_snapshot WHERE actor_id = ?").get(actorId);
      return row ? readSnapshot(row) : undefined;
    },
    loadErroredSnapshot(actorId) {
      const row = database
        .prepare("SELECT * FROM store_errored_snapshot WHERE actor_id = ?")
        .get(actorId);
      return row
        ? {
            ...readSnapshot(row),
            eventId: row["event_id"] === null ? undefined : (row["event_id"] as string),
          }
        : undefined;
    },
    findActorsInState({ machine, statePath }) {
      const query =
        machine === undefined
          ? database
              .prepare(
                "SELECT snapshot.* FROM store_snapshot_state state JOIN store_snapshot snapshot ON snapshot.actor_id = state.actor_id WHERE state.state_path = ? ORDER BY state.actor_id",
              )
              .all(statePath)
          : database
              .prepare(
                "SELECT snapshot.* FROM store_snapshot_state state JOIN store_snapshot snapshot ON snapshot.actor_id = state.actor_id WHERE state.machine = ? AND state.state_path = ? ORDER BY state.actor_id",
              )
              .all(machine, statePath);
      return query.map(readSnapshot);
    },
    writeInbox(event, actorIds) {
      return connection.transaction(() => {
        const rows: InboxRow[] = [];
        const receivedAt = now();
        const insert = database.prepare(
          "INSERT INTO store_inbox (event_id, actor_id, topic, payload, received_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (actor_id, event_id) DO NOTHING RETURNING *",
        );
        for (const actorId of actorIds) {
          const row = insert.get(
            event.eventId,
            actorId,
            event.topic,
            JSON.stringify(event.payload),
            receivedAt,
          );
          if (row) rows.push(readInbox(row));
        }
        return rows;
      });
    },
    actorInbox(actorId) {
      return database
        .prepare("SELECT * FROM store_inbox WHERE actor_id = ? ORDER BY sequence")
        .all(actorId)
        .map(readInbox);
    },
    pendingInbox(actorId) {
      return database
        .prepare(
          "SELECT * FROM store_inbox WHERE actor_id = ? AND consumed_at IS NULL ORDER BY sequence",
        )
        .all(actorId)
        .map(readInbox);
    },
    markConsumed(actorId, eventId) {
      connection.transaction(() =>
        database
          .prepare(
            "UPDATE store_inbox SET consumed_at = ? WHERE actor_id = ? AND event_id = ? AND consumed_at IS NULL",
          )
          .run(now(), actorId, eventId),
      );
    },
    deliver(target, row) {
      if (row.actorId !== target.actorId) throw new TypeError("Inbox row belongs to another actor");
      const current = database
        .prepare("SELECT * FROM store_inbox WHERE sequence = ?")
        .get(row.sequence);
      if (current?.["consumed_at"] !== null) return "already-consumed";
      target.send(row);
      probe?.("sent", row);
      const persisted = target.persist();
      const write = { ...persisted, actorId: target.actorId, eventId: row.eventId };
      if (persisted.snapshot.status === "error") {
        store.saveSnapshot(write);
        return "errored";
      }
      connection.transaction(() => {
        store.saveSnapshot(write);
        target.saved?.(write);
        probe?.("saved", row);
        store.markConsumed(row.actorId, row.eventId);
      });
      return "delivered";
    },
    drain(target) {
      let delivered = 0;
      while (true) {
        const row = database
          .prepare(
            "SELECT * FROM store_inbox WHERE actor_id = ? AND consumed_at IS NULL ORDER BY sequence LIMIT 1",
          )
          .get(target.actorId);
        if (!row) return { delivered, erroredAt: undefined };
        const inbox = readInbox(row);
        const outcome = store.deliver(target, inbox);
        if (outcome === "errored") return { delivered, erroredAt: inbox };
        if (outcome === "delivered") delivered++;
      }
    },
    nextDeadlineAt() {
      return database
        .prepare(
          "SELECT fire_at FROM store_deadline WHERE fired_at IS NULL ORDER BY fire_at LIMIT 1",
        )
        .get()?.["fire_at"] as number | undefined;
    },
    dueDeadlines(at) {
      return database
        .prepare(
          "SELECT * FROM store_deadline WHERE fired_at IS NULL AND fire_at <= ? ORDER BY fire_at, actor_id",
        )
        .all(at)
        .map(readDeadline);
    },
    fireDeadline(deadline, topic) {
      return connection.transaction(() => {
        const row = database
          .prepare(
            "UPDATE store_deadline SET fired_at = ? WHERE deadline_id = ? AND fired_at IS NULL RETURNING *",
          )
          .get(now(), deadline.deadlineId);
        if (!row) return undefined;
        return store.writeInbox(
          {
            eventId: `deadline:${deadline.deadlineId}`,
            topic,
            payload: { type: row["event_name"] as string },
          },
          [row["actor_id"] as string],
        )[0];
      });
    },
    close() {
      database.close();
    },
  };
  return store;
}
