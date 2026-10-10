// ---
// relationships:
//   implements: escalations-database-schema
// ---
import type { SQLOutputValue } from "node:sqlite";
import { storedText } from "../store/index.ts";
import type { SQLInputValue } from "node:sqlite";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Store } from "../store/index.ts";
import type { EscalationsConfiguration } from "../service-configuration/index.ts";
import { askMessage, closeMessage, digest, idOf, subjectOf, inputOf } from "./records.ts";
import type {
  Escalation,
  EscalationStatus,
  EscalateInput,
  Invocation,
  ServiceEscalationRequest,
} from "./types.ts";
interface EscalationRow {
  escalation_id: string;
  actor_id: string | null;
  invoke_id: string | null;
  entry_id: string | null;
  kind: ServiceEscalationRequest["kind"] | null;
  subject: string | null;
  occurrence: number | null;
  title: string;
  question: string;
  choices: string;
  free_text: number;
  destinations: string;
  key_digest: Uint8Array;
  status: EscalationStatus;
  answer: string | null;
  channel: "link" | "api" | null;
  raised_at: number;
  closed_at: number | null;
  taken_at: number | null;
  handled_at: number | null;
}
export interface NotificationRow {
  notification_id: number;
  escalation_id: string;
  destination: string;
  purpose: "ask" | "close";
  message: string;
  attempts: number;
}
export function escalationRows(
  store: Store,
  configuration: EscalationsConfiguration,
  now: () => number,
  warn: (message: string) => void,
) {
  const db = store.connection.database;
  function rows(sql: string, ...args: SQLInputValue[]): EscalationRow[] {
    return db
      .prepare(sql)
      .all(...args)
      .map((row) => ({
        ...row,
        escalation_id: storedText(row["escalation_id"]!),
        actor_id: row["actor_id"] === null ? null : storedText(row["actor_id"]!),
        invoke_id: row["invoke_id"] === null ? null : storedText(row["invoke_id"]!),
        entry_id: row["entry_id"] === null ? null : storedText(row["entry_id"]!),
        title: storedText(row["title"]!),
        question: storedText(row["question"]!),
      })) as unknown as EscalationRow[];
  }
  function row(id: string) {
    return rows(
      "SELECT CAST(escalation_id AS BLOB) AS escalation_id, CAST(actor_id AS BLOB) AS actor_id, CAST(invoke_id AS BLOB) AS invoke_id, CAST(entry_id AS BLOB) AS entry_id, kind, subject, occurrence, CAST(title AS BLOB) AS title, CAST(question AS BLOB) AS question, choices, free_text, destinations, key_digest, status, answer, channel, raised_at, closed_at, taken_at, handled_at FROM escalation WHERE escalation_id = ?",
      id,
    )[0];
  }
  function decode(row: EscalationRow): Escalation {
    return {
      id: row.escalation_id,
      raiser:
        row.actor_id !== null
          ? {
              type: "blueprint",
              actorId: row.actor_id,
              invokeId: row.invoke_id!,
              entryId: row.entry_id!,
            }
          : {
              type: "service",
              kind: row.kind!,
              subject: JSON.parse(row.subject!) as Record<string, string>,
              occurrence: row.occurrence!,
            },
      title: row.title,
      question: row.question,
      choices: JSON.parse(row.choices) as Escalation["choices"],
      freeText: row.free_text === 1,
      destinations: JSON.parse(row.destinations) as string[],
      status: row.status,
      raisedAt: row.raised_at,
      ...(row.closed_at === null ? {} : { closedAt: row.closed_at }),
      ...(row.answer === null
        ? {}
        : {
            answer: {
              value: JSON.parse(row.answer) as NonNullable<Escalation["answer"]>["value"],
              channel: row.channel!,
              at: row.closed_at!,
            },
          }),
    };
  }
  function notification(
    escalation: Escalation,
    destination: string,
    purpose: "ask" | "close",
    message: unknown,
  ) {
    const known = Object.hasOwn(configuration.destinations, destination);
    db.prepare(
      "INSERT INTO escalation_notification(escalation_id,destination,purpose,message,status,attempts,next_attempt_at,last_error,created_at,settled_at) VALUES(?,?,?,?,?,0,?,?,?,?) ON CONFLICT DO NOTHING",
    ).run(
      escalation.id,
      destination,
      purpose,
      known ? JSON.stringify(message) : null,
      known ? "pending" : "failed",
      now(),
      known ? null : "unknown destination",
      now(),
      known ? null : now(),
    );
    if (!known) warn(`Notification destination ${destination}: unknown destination`);
  }
  function insert(id: string, raiser: Escalation["raiser"], input: EscalateInput) {
    const existing = row(id);
    if (existing) return decode(existing);
    const normalized = inputOf(input);
    // The absent default destination means API-only; explicit unknown names fail a notification.
    const destinations = normalized.destinations.filter(
      (name) => name !== "default" || Object.hasOwn(configuration.destinations, "default"),
    );
    const key = randomBytes(32).toString("base64url");
    const blueprint = raiser.type === "blueprint" ? raiser : undefined;
    const service = raiser.type === "service" ? raiser : undefined;
    db.prepare(
      `INSERT INTO escalation(escalation_id,actor_id,invoke_id,entry_id,kind,subject,occurrence,title,question,choices,free_text,destinations,key_digest,status,raised_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'open',?)`,
    ).run(
      id,
      blueprint?.actorId ?? null,
      blueprint?.invokeId ?? null,
      blueprint?.entryId ?? null,
      service?.kind ?? null,
      service ? subjectOf(service.subject) : null,
      service?.occurrence ?? null,
      normalized.title,
      normalized.question,
      JSON.stringify(normalized.choices),
      Number(normalized.freeText),
      JSON.stringify(destinations),
      digest(key),
      now(),
    );
    const escalation = decode(row(id)!);
    for (const destination of destinations)
      notification(
        escalation,
        destination,
        "ask",
        askMessage(
          escalation,
          key,
          configuration.publicUrl ?? "http://localhost",
          configuration.destinations[destination]?.priority ?? 4,
        ),
      );
    return escalation;
  }
  function close(id: string) {
    const escalation = decode(row(id)!);
    const asks = db
      .prepare(
        "SELECT CAST(destination AS BLOB) AS destination FROM escalation_notification WHERE escalation_id=? AND purpose='ask' AND (status='sent' OR (status='pending' AND attempts>0) OR (status='failed' AND attempts>1))",
      )
      .all(id)
      .map(readNotificationDestination);
    db.prepare(
      "UPDATE escalation_notification SET status='cancelled',message=NULL,settled_at=? WHERE escalation_id=? AND purpose='ask' AND status='pending'",
    ).run(now(), id);
    for (const ask of asks)
      notification(escalation, String(ask["destination"]), "close", closeMessage(escalation));
  }
  function withdrawId(id: string) {
    if (
      db
        .prepare(
          "UPDATE escalation SET status='withdrawn',closed_at=? WHERE escalation_id=? AND status='open'",
        )
        .run(now(), id).changes
    )
      close(id);
  }
  return {
    row,
    decode,
    rows,
    close,
    withdrawId,
    get: (id: string) => {
      const found = row(id);
      return found ? decode(found) : undefined;
    },
    list: (status?: EscalationStatus) =>
      rows(
        `SELECT CAST(escalation_id AS BLOB) AS escalation_id, CAST(actor_id AS BLOB) AS actor_id, CAST(invoke_id AS BLOB) AS invoke_id, CAST(entry_id AS BLOB) AS entry_id, kind, subject, occurrence, CAST(title AS BLOB) AS title, CAST(question AS BLOB) AS question, choices, free_text, destinations, key_digest, status, answer, channel, raised_at, closed_at, taken_at, handled_at FROM escalation ${status ? "WHERE status=?" : ""} ORDER BY raised_at DESC, escalation_id DESC`,
        ...(status ? [status] : []),
      ).map(decode),
    keyMatches: (id: string, key: string) => {
      const found = row(id);
      return found !== undefined && timingSafeEqual(found.key_digest, digest(key));
    },
    raiseBlueprint: (invocation: Invocation, input: EscalateInput) =>
      store.connection.transaction(() =>
        insert(
          idOf(["blueprint", invocation.actorId, invocation.invokeId, invocation.entryId]),
          { type: "blueprint", ...invocation },
          input,
        ),
      ),
    raise: (request: ServiceEscalationRequest) =>
      store.connection.transaction(() => {
        const latest = rows(
          "SELECT CAST(escalation_id AS BLOB) AS escalation_id, CAST(actor_id AS BLOB) AS actor_id, CAST(invoke_id AS BLOB) AS invoke_id, CAST(entry_id AS BLOB) AS entry_id, kind, subject, occurrence, CAST(title AS BLOB) AS title, CAST(question AS BLOB) AS question, choices, free_text, destinations, key_digest, status, answer, channel, raised_at, closed_at, taken_at, handled_at FROM escalation WHERE kind=? AND subject=? ORDER BY occurrence DESC LIMIT 1",
          request.kind,
          subjectOf(request.subject),
        )[0];
        if (
          latest &&
          (latest.status === "open" || (latest.status === "answered" && latest.handled_at === null))
        )
          return decode(latest);
        const occurrence = (latest?.occurrence ?? 0) + 1;
        return insert(
          idOf(["service", request.kind, subjectOf(request.subject), occurrence]),
          { type: "service", kind: request.kind, subject: request.subject, occurrence },
          {
            question: request.question,
            choices: request.choices,
            ...(request.title === undefined ? {} : { title: request.title }),
            ...(request.freeText === undefined ? {} : { freeText: request.freeText }),
          },
        );
      }),
    withdraw: (request: Pick<ServiceEscalationRequest, "kind" | "subject">) => {
      for (const found of rows(
        "SELECT CAST(escalation_id AS BLOB) AS escalation_id, CAST(actor_id AS BLOB) AS actor_id, CAST(invoke_id AS BLOB) AS invoke_id, CAST(entry_id AS BLOB) AS entry_id, kind, subject, occurrence, CAST(title AS BLOB) AS title, CAST(question AS BLOB) AS question, choices, free_text, destinations, key_digest, status, answer, channel, raised_at, closed_at, taken_at, handled_at FROM escalation WHERE kind=? AND subject=? AND status='open'",
        request.kind,
        subjectOf(request.subject),
      ))
        withdrawId(found.escalation_id);
    },
    due: () =>
      readNotification(
        db
          .prepare(
            "SELECT notification_id, CAST(escalation_id AS BLOB) AS escalation_id, CAST(destination AS BLOB) AS destination, purpose, message, status, attempts, next_attempt_at, CAST(last_error AS BLOB) AS last_error, created_at, settled_at FROM escalation_notification WHERE status='pending' AND next_attempt_at<=? ORDER BY notification_id LIMIT 1",
          )
          .get(now()),
      ) as unknown as NotificationRow | undefined,
    next: () =>
      db
        .prepare(
          "SELECT MIN(next_attempt_at) AS at FROM escalation_notification WHERE status='pending'",
        )
        .get()?.["at"] as number | null,
  };
}
export type EscalationRows = ReturnType<typeof escalationRows>;

function readNotificationDestination<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return { ...values, destination: storedText(values["destination"]!) } as T;
}
function readNotification<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return {
    ...values,
    escalation_id: storedText(values["escalation_id"]!),
    destination: storedText(values["destination"]!),
    last_error: values["last_error"] === null ? null : storedText(values["last_error"]!),
  } as T;
}
