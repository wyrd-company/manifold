// ---
// relationships:
//   implements: agent-tools
// ---
import type { SQLOutputValue } from "node:sqlite";
import { storedText } from "../store/index.ts";
import { fromPromise } from "xstate";
import { agentToolsSchema, createSchemaCompiler } from "@wyrd-company/manifold-shared";
import type { ThreadMessage } from "@wyrd-company/manifold-shared";
import { invocationOf } from "../actor-host/index.ts";
import type { ActorSave, Invocation } from "../actor-host/index.ts";
import {
  agentThreadTopic,
  eventId,
  messageId as deriveMessageId,
  readText,
  noticeText,
} from "./calls.ts";
import type { AgentToolsOptions, Identity } from "./types.ts";

interface SendInput {
  to: { issue: string } | { environment: string; threadId: string };
  text: string;
}
export interface NoticeRequest {
  environment: string;
  threadId?: string;
  callId?: string;
}
const validate = createSchemaCompiler()([
  { $ref: agentToolsSchema.$id + "#/$defs/send-message-input" },
])[0]!;
const failure = (kind: "input" | "no-recipient" | "not-accepted", message: string) => ({
  type: "send-message",
  kind,
  message,
});
export function messages(options: AgentToolsOptions) {
  const db = options.store.connection.database;
  const now = () => options.clock?.now() ?? Date.now();
  function send(input: unknown, invocation: Invocation) {
    if (!validate(input)) throw failure("input", "Correct the message address and text.");
    const { to, text } = input as SendInput;
    if ("environment" in to && !options.environments.has(to.environment))
      throw failure("input", "Unknown environment.");
    const actors = options.actors();
    const addresses = "issue" in to ? actors.issueThreads(to.issue) : [to];
    const recipients = [
      ...new Map(
        addresses.map((address) => [
          JSON.stringify([address.environment, address.threadId]),
          address,
        ]),
      ).values(),
    ].sort(
      (a, b) => a.environment.localeCompare(b.environment) || a.threadId.localeCompare(b.threadId),
    );
    const issue = actors.actorOf(invocation.actorId)?.manifold.issue ?? null;
    const task = issue === null ? undefined : options.trackedIssue(issue);
    const from: ThreadMessage["from"] = {
      actorId: invocation.actorId,
      issue,
      task: task
        ? {
            repository: task.repository,
            number: task.number,
            ...(typeof task.title === "string" && task.title.length > 0
              ? { title: task.title }
              : {}),
          }
        : null,
    };
    const sent = options.store.connection.transaction(() => {
      const sent: { messageId: string; environment: string; threadId: string }[] = [];
      let followed = false;
      for (const { environment, threadId } of recipients) {
        const messageId = deriveMessageId(invocation, environment, threadId);
        const recipient = { messageId, environment, threadId };
        if (db.prepare("SELECT 1 FROM agenttool_message WHERE message_id=?").get(messageId)) {
          sent.push(recipient);
          continue;
        }
        if (!actors.followers(environment, threadId).length) continue;
        followed = true;
        const published = options.router().publish({
          source: "agent",
          eventId: "message/" + messageId,
          topics: [agentThreadTopic(environment, threadId)],
          event: { type: "agent.message", environment, threadId, messageId, from, text },
        });
        if (published.status === "rejected") throw failure("input", "Invalid message event.");
        if (!published.rows.length) continue;
        db.prepare(
          "INSERT INTO agenttool_message(message_id,environment,thread_id,sender_actor_id,sender_issue,text,sent_at,sender_repository,sender_number,sender_title) VALUES (?,?,?,?,?,?,?,?,?,?)",
        ).run(
          messageId,
          environment,
          threadId,
          from.actorId,
          from.issue,
          text,
          now(),
          from.task?.repository ?? null,
          from.task?.number ?? null,
          from.task?.title ?? null,
        );
        sent.push(recipient);
      }
      if (!sent.length)
        throw failure(
          followed ? "not-accepted" : "no-recipient",
          "No recipient takes this message.",
        );
      return sent;
    });
    return { messages: sent };
  }
  return {
    implementations: {
      actorKinds: { "send-message": "promise" as const },
      actors: {
        "send-message": fromPromise(async (args) => {
          args.signal.throwIfAborted();
          return send(args.input, invocationOf(args));
        }),
      },
      actions: {},
      guards: {},
      delays: {},
    },
    saving(save: ActorSave) {
      const prefix = "agent:message/";
      if (
        !save.eventId?.startsWith(prefix) ||
        options.actors().eventSchema(save.actorId, "agent.message").status !== "declared"
      )
        return;
      db.prepare(
        "UPDATE agenttool_message SET delivered_at=?, delivered_to=? WHERE message_id=? AND delivered_at IS NULL",
      ).run(now(), save.actorId, save.eventId.slice(prefix.length));
    },
    read(identity: Identity) {
      const batch = options.store.connection.transaction(() => {
        let position = Number(
          db
            .prepare(
              "SELECT COALESCE(MAX(read_position),0) AS position FROM agenttool_message WHERE environment=? AND thread_id=?",
            )
            .get(identity.environment, identity.threadId)!["position"],
        );
        const unread = db
          .prepare(
            "SELECT CAST(message_id AS BLOB) AS message_id FROM agenttool_message WHERE environment=? AND thread_id=? AND delivered_at IS NOT NULL AND read_at IS NULL ORDER BY sequence",
          )
          .all(identity.environment, identity.threadId)
          .map(readMessageId);
        for (const row of unread)
          db.prepare(
            "UPDATE agenttool_message SET read_at=?,read_turn_id=?,read_position=? WHERE message_id=?",
          ).run(now(), identity.turnId, ++position, String(row["message_id"]));
        return db
          .prepare(
            "SELECT sequence, CAST(message_id AS BLOB) AS message_id, CAST(environment AS BLOB) AS environment, CAST(thread_id AS BLOB) AS thread_id, CAST(sender_actor_id AS BLOB) AS sender_actor_id, CAST(sender_issue AS BLOB) AS sender_issue, CAST(text AS BLOB) AS text, sent_at, delivered_at, CAST(delivered_to AS BLOB) AS delivered_to, noticed_at, read_at, CAST(read_turn_id AS BLOB) AS read_turn_id, read_position, CAST(sender_repository AS BLOB) AS sender_repository, sender_number, CAST(sender_title AS BLOB) AS sender_title FROM agenttool_message WHERE environment=? AND thread_id=? AND read_turn_id=? ORDER BY read_position",
          )
          .all(identity.environment, identity.threadId, identity.turnId)
          .map(readMessage)
          .map((row): ThreadMessage => ({
            messageId: String(row["message_id"]),
            from: {
              actorId: String(row["sender_actor_id"]),
              issue: row["sender_issue"] === null ? null : String(row["sender_issue"]),
              task:
                row["sender_repository"] === null
                  ? null
                  : {
                      repository: String(row["sender_repository"]),
                      number: Number(row["sender_number"]),
                      ...(row["sender_title"] === null
                        ? {}
                        : { title: String(row["sender_title"]) }),
                    },
            },
            text: String(row["text"]),
            sentAt: new Date(Number(row["sent_at"])).toISOString(),
            deliveredAt: new Date(Number(row["delivered_at"])).toISOString(),
          }));
      });
      options.probe?.({
        tool: "get-messages",
        eventId: eventId(identity, "get-messages"),
        replay: false,
      });
      return {
        status: "read" as const,
        threadId: identity.threadId,
        turnId: identity.turnId,
        messages: batch,
        message: readText(batch),
      };
    },
    async notice(request: NoticeRequest, signal: AbortSignal) {
      let threadId =
        request.threadId && options.actors().followers(request.environment, request.threadId).length
          ? request.threadId
          : undefined;
      if (!threadId && request.callId) {
        if (!options.sourceReady(request.environment)) return { notice: null };
        const candidates = db
          .prepare(
            "SELECT DISTINCT CAST(thread_id AS BLOB) AS thread_id FROM agenttool_message WHERE environment=? AND delivered_at IS NOT NULL AND read_at IS NULL AND noticed_at IS NULL ORDER BY thread_id",
          )
          .all(request.environment)
          .map(readMessageThreadId);
        const matches: string[] = [];
        for (const row of candidates) {
          const id = String(row["thread_id"]);
          if (!options.actors().followers(request.environment, id).length) continue;
          try {
            if (!options.sourceReady(request.environment) || signal.aborted)
              return { notice: null };
            const thread = await options.threads.readThread(request.environment, id, signal);
            if (!options.sourceReady(request.environment)) return { notice: null };
            if (
              thread?.activities.some(
                (activity) =>
                  typeof activity.payload === "object" &&
                  activity.payload !== null &&
                  "toolCallId" in activity.payload &&
                  activity.payload.toolCallId === request.callId,
              )
            )
              matches.push(id);
          } catch {
            /* A notice never refuses an unavailable environment. */
          }
        }
        if (matches.length === 1) threadId = matches[0];
      }
      if (!threadId || signal.aborted) return { notice: null };
      const count = options.store.connection.transaction(
        () =>
          db
            .prepare(
              "UPDATE agenttool_message SET noticed_at=? WHERE environment=? AND thread_id=? AND delivered_at IS NOT NULL AND read_at IS NULL AND noticed_at IS NULL",
            )
            .run(now(), request.environment, threadId!).changes,
      );
      return { notice: noticeText(count) };
    },
  };
}

function readMessageId<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return { ...values, message_id: storedText(values["message_id"]!) } as T;
}
function readMessage<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return {
    ...values,
    message_id: storedText(values["message_id"]!),
    environment: storedText(values["environment"]!),
    thread_id: storedText(values["thread_id"]!),
    sender_actor_id: storedText(values["sender_actor_id"]!),
    sender_issue: values["sender_issue"] === null ? null : storedText(values["sender_issue"]!),
    text: storedText(values["text"]!),
    delivered_to: values["delivered_to"] === null ? null : storedText(values["delivered_to"]!),
    read_turn_id: values["read_turn_id"] === null ? null : storedText(values["read_turn_id"]!),
    sender_repository:
      values["sender_repository"] === null ? null : storedText(values["sender_repository"]!),
    sender_title: values["sender_title"] === null ? null : storedText(values["sender_title"]!),
  } as T;
}
function readMessageThreadId<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return { ...values, thread_id: storedText(values["thread_id"]!) } as T;
}
