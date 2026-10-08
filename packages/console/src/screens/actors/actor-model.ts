// ---
// relationships:
//   implements: operator-console
// ---
import type { ActorHistory, ReceivedEvent } from "../../api/actor-history.ts";
import type {
  ActorUsageResponse,
  ActorActual,
  ActorTokens,
} from "@wyrd-company/manifold-shared/actor-usage-api";
import type { Escalation } from "@wyrd-company/manifold-shared/escalations-api";
export interface ActorModelInput {
  history: ActorHistory;
  usage: ActorUsageResponse | undefined;
  escalations: readonly Escalation[];
  held: boolean;
  now: number;
}
export type Tone = "edge" | "primary" | "waiting" | "warning" | "error" | "muted";
export interface Pass {
  number: number;
  thread: string;
  threadId: string;
  environment: string;
  turnId?: string | undefined;
  start: number;
  label: string;
  answer?: string;
  close?: string;
  closingEvent?: string;
  end?: number;
  running: boolean;
  tokens: number;
  accounts: readonly ActorActual[];
}
export interface TimelineRow {
  visit: number;
  states: readonly string[];
  start: number;
  end: number;
  exit: string;
  tone: Tone;
  tokens: number;
  tokenClasses: ActorTokens | undefined;
  accounts: readonly ActorActual[];
  passes: readonly number[];
  commit?: string;
}
export interface ActorTimeline {
  start: number;
  end: number;
  duration: number;
  rows: readonly TimelineRow[];
  total: {
    tokens: number;
    accounts: readonly ActorActual[];
    tokenClasses: ActorTokens | undefined;
  };
}
export interface SequenceMessage {
  id: string;
  at: number;
  from: string;
  to: string;
  label: string;
  style: "solid" | "dashed" | "self" | "note";
  tone: Tone;
  pass?: number;
  tokens?: number;
  accounts?: readonly ActorActual[];
}
export interface ActorSequence {
  lifelines: readonly { id: string; label: string }[];
  messages: readonly SequenceMessage[];
  unattributed: { tokens: number; accounts: readonly ActorActual[] };
}
const time = (s: string) => Date.parse(s);
const object = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const text = (v: unknown) => (typeof v === "string" ? v : "");
const threadKey = (environment: string, thread: string) => `${environment}/${thread}`;
const eventThread = (input: ActorModelInput, e: ReceivedEvent) => {
  const p = object(e.payload),
    id = text(p["threadId"]),
    environment =
      text(p["environment"]) ||
      input.history.commands.find((c) => c.threadId === id)?.environment ||
      input.history.actor.environment ||
      "";
  return threadKey(environment, id);
};
function answerText(input: ActorModelInput, event: ReceivedEvent): string {
  const p = object(event.payload),
    a = object(p["answer"]),
    value = object(a["value"] ?? p["answer"]);
  const escalation = input.escalations.find((e) => e.id === p["escalationId"]);
  return (
    text(value["text"]) ||
    escalation?.choices.find((c) => c.id === value["choice"])?.label ||
    text(value["choice"]) ||
    text(p["text"])
  );
}
const totals = (calls: ActorUsageResponse["calls"], units: readonly ActorActual[]) => {
  const accounts = new Map<string, number>();
  let tokens = 0;
  for (const c of calls) {
    tokens += c.total;
    if (c.account !== null && c.actual !== null)
      accounts.set(c.account, (accounts.get(c.account) ?? 0) + c.actual);
  }
  return {
    tokens,
    accounts: [...accounts]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([account, actual]) => ({
        account,
        actual,
        ...(units.find((a) => a.account === account)?.unit
          ? { unit: units.find((a) => a.account === account)!.unit! }
          : {}),
      })),
  };
};
export function actorPasses(input: ActorModelInput): readonly Pass[] {
  const { history, usage } = input;
  const starts = [
    ...history.commands
      .filter((c) => c.kind === "turn-start")
      .map((c) => ({
        id: c.commandId,
        at: time(c.sentAt),
        environment: c.environment,
        threadId: c.threadId,
        turnId: c.turnId,
      })),
    ...history.events
      .filter(
        (e) =>
          e.type === "agent.escalation.answered" &&
          e.consumedAt !== undefined &&
          typeof object(e.payload)["turnId"] === "string",
      )
      .map((e) => {
        const p = object(e.payload);
        return {
          id: e.eventId,
          at: time(e.receivedAt),
          environment: text(p["environment"]) || history.actor.environment || "",
          threadId: text(p["threadId"]),
          turnId: text(p["turnId"]),
          answer: answerText(input, e),
        };
      }),
  ].toSorted((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  return starts.map((s, index) => {
    const thread = threadKey(s.environment, s.threadId),
      previous = starts
        .slice(0, index)
        .findLast((p) => threadKey(p.environment, p.threadId) === thread);
    const created = history.commands.some(
      (c) =>
        c.kind === "thread-create" &&
        threadKey(c.environment, c.threadId) === thread &&
        time(c.sentAt) <= s.at &&
        (!previous || time(c.sentAt) > previous.at),
    );
    const matches = history.events
      .filter(
        (e) =>
          e.consumedAt !== undefined &&
          time(e.consumedAt) >= s.at &&
          s.turnId !== undefined &&
          object(e.payload)["turnId"] === s.turnId &&
          eventThread(input, e) === thread,
      )
      .toSorted((a, b) => time(a.consumedAt!) - time(b.consumedAt!));
    const closed =
      matches.find((e) => e.type === "agent.handoff") ??
      matches.find((e) => e.type === "t3.turn.settled");
    const next = starts
      .slice(index + 1)
      .find((n) => threadKey(n.environment, n.threadId) === thread);
    const calls =
      usage?.calls.filter(
        (c) =>
          c.thread !== null &&
          threadKey(c.thread.environment, c.thread.threadId) === thread &&
          time(c.usedAt) >= s.at &&
          (!next || time(c.usedAt) < next.at),
      ) ?? [];
    return {
      number: index + 1,
      thread,
      threadId: s.threadId,
      environment: s.environment,
      turnId: s.turnId,
      start: s.at,
      label: created ? "Start thread" : "Continue thread",
      ...("answer" in s && typeof s.answer === "string" ? { answer: s.answer } : {}),
      ...(closed
        ? {
            close:
              closed.type === "agent.handoff"
                ? "handoff"
                : object(closed.payload)["state"] === "completed"
                  ? "idle"
                  : text(object(closed.payload)["state"]),
            closingEvent: closed.eventId,
            end: time(closed.consumedAt!),
          }
        : {}),
      running: !closed && history.actor.status === "active",
      ...totals(calls, usage?.accounts ?? []),
    };
  });
}
function fieldValue(value: unknown): string {
  const v = object(value);
  switch (v["kind"]) {
    case "single-select":
      return text(v["name"]);
    case "iteration":
      return text(v["title"]);
    case "text":
      return text(v["text"]);
    case "date":
      return text(v["date"]);
    case "number":
      return String(v["number"]);
    default:
      return value === null ? "—" : text(value);
  }
}
function exitLabel(
  input: ActorModelInput,
  type: string,
  event: ReceivedEvent | undefined,
  passes: readonly Pass[],
): string {
  if (type === "agent.handoff") return "handoff";
  if (type === "t3.turn.settled")
    return passes.find((p) => p.closingEvent === event?.eventId)?.close ?? type;
  if (type === "agent.escalation.answered")
    return `answered: ${event ? answerText(input, event) : ""}`;
  if (type === "github.project-item.field-changed") {
    const p = object(event?.payload);
    return `${text(object(p["field"])["name"])}: ${fieldValue(p["to"])}`;
  }
  if (type.startsWith("xstate.done.actor."))
    return `${type.slice("xstate.done.actor.".length)} done`;
  if (type.startsWith("xstate.error.actor."))
    return `${type.slice("xstate.error.actor.".length)} failed`;
  return type;
}
const canonical = (v: unknown): string =>
  JSON.stringify(v, (_k, item: unknown) =>
    typeof item === "object" && item !== null && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
export function actorTimeline(input: ActorModelInput): ActorTimeline {
  const { history, usage, now } = input,
    passes = actorPasses(input),
    active = history.actor.status === "active";
  let run = 0,
    lastValue: string | undefined;
  const rows = history.visits.map((v, index): TimelineRow => {
    const value = canonical(v.value),
      first = value !== lastValue;
    if (first) run++;
    lastValue = value;
    const start = time(v.enteredAt),
      end = v.exitedAt
        ? time(v.exitedAt)
        : active
          ? now
          : time(history.end?.endedAt ?? v.enteredAt);
    const counted = first ? usage?.visits.find((u) => u.visit === run) : undefined;
    const events = history.events.filter((e) => e.visit === v.visit && e.consumedAt !== undefined);
    const answered = input.escalations.find(
      (e) =>
        e.status === "answered" &&
        e.closedAt !== undefined &&
        e.closedAt >= start &&
        e.closedAt <= end,
    );
    const answer = answered?.answer?.value;
    let exit = !v.exitedAt
      ? active
        ? "running"
        : ""
      : v.exitEvent
        ? exitLabel(
            input,
            v.exitEvent.type,
            history.events.find((e) => e.eventId === v.exitEvent?.eventId),
            passes,
          )
        : "";
    if (answer)
      exit = `answered: ${"text" in answer ? answer.text : (answered!.choices.find((c) => c.id === answer.choice)?.label ?? answer.choice)}`;
    const warning =
      events.some(
        (e) =>
          e.type === "agent.escalated" ||
          passes.some((p) => p.closingEvent === e.eventId && p.close !== "handoff"),
      ) || input.escalations.some((e) => e.raisedAt <= end && (e.closedAt ?? now) >= start);
    const tone: Tone =
      input.held && index === history.visits.length - 1
        ? "error"
        : warning
          ? "warning"
          : !v.exitedAt && active
            ? "primary"
            : passes.some((p) => p.running && p.start <= end)
              ? "waiting"
              : "edge";
    const previous = history.visits[index - 1];
    const migration =
      previous &&
      !previous.exitEvent &&
      (previous.machine !== v.machine || previous.blueprint?.commit !== v.blueprint?.commit);
    return {
      visit: v.visit,
      states: v.states,
      start,
      end: Math.max(start, end),
      exit,
      tone,
      tokens: counted?.tokens.total ?? 0,
      tokenClasses: counted?.tokens,
      accounts: (counted?.accounts ?? []).map((a) => {
        const unit = usage?.accounts.find((total) => total.account === a.account)?.unit;
        return { ...a, ...(unit === undefined ? {} : { unit }) };
      }),
      passes: passes.filter((p) => p.start < end && (p.end ?? now) > start).map((p) => p.number),
      ...(migration && v.blueprint ? { commit: v.blueprint.commit } : {}),
    };
  });
  const start = rows[0]?.start ?? now,
    end = rows.at(-1)?.end ?? start;
  return {
    start,
    end,
    duration: Math.max(0, end - start),
    rows,
    total: {
      tokens: usage?.tokens.total ?? 0,
      accounts: usage?.accounts ?? [],
      tokenClasses: usage?.tokens,
    },
  };
}
export function actorSequence(input: ActorModelInput): ActorSequence {
  const passes = actorPasses(input),
    threads = new Map<string, string>(),
    messages: SequenceMessage[] = [];
  const addThread = (key: string, id: string) => {
    if (id) threads.set(key, `T3 Code thread · ${id.slice(0, 8)}`);
  };
  const ordered = [
    ...input.history.commands.map((c) => ({
      at: time(c.sentAt),
      thread: threadKey(c.environment, c.threadId),
      id: c.threadId,
    })),
    ...input.history.events.map((e) => ({
      at: time(e.receivedAt),
      thread: eventThread(input, e),
      id: text(object(e.payload)["threadId"]),
    })),
  ].toSorted((a, b) => a.at - b.at);
  for (const t of ordered) addThread(t.thread, t.id);
  for (const p of passes)
    messages.push({
      id: `pass-${p.number}`,
      at: p.start,
      from: "manifold",
      to: p.thread,
      label: p.answer === undefined ? p.label : `Continue thread · answer: ${p.answer}`,
      style: "solid",
      tone: "edge",
      pass: p.number,
    });
  for (const e of input.history.events) {
    const pending = e.consumedAt === undefined;
    if (pending && input.history.actor.status !== "active") continue;
    const p = object(e.payload),
      source = e.topic.split(".")[0],
      pass = passes.find((p) => p.closingEvent === e.eventId);
    if (
      !pending &&
      (e.type === "t3.turn.started" ||
        (e.type === "agent.escalation.answered" && typeof p["turnId"] === "string") ||
        (e.type === "t3.turn.settled" &&
          passes.some(
            (pass) =>
              pass.turnId === p["turnId"] &&
              pass.thread === eventThread(input, e) &&
              pass.close === "handoff",
          )))
    )
      continue;
    let from = "manifold",
      to = "manifold",
      style: SequenceMessage["style"] = "self",
      label = e.type,
      tone: Tone = "edge";
    if (source === "agent" || source === "t3") {
      from = eventThread(input, e);
      style = "dashed";
      if (!threads.has(from)) from = "manifold";
      label = pass?.close ?? (e.type === "agent.escalated" ? "escalated" : e.type);
      if (
        (pass && pass.close !== "handoff") ||
        [
          "agent.escalated",
          "t3.session.failed",
          "t3.thread.archived",
          "t3.thread.deleted",
        ].includes(e.type)
      )
        tone = "warning";
    } else if (source === "github") {
      from = "github";
      style = "dashed";
      if (e.type === "github.project-item.field-changed") {
        const moved = object(p["movedBy"]);
        if (moved["actorId"] === input.history.actor.actorId) {
          from = "manifold";
          to = "github";
          style = "solid";
          label = `Move to ${fieldValue(p["to"])} · ${moved["confirmed"] === false ? "unconfirmed" : "confirmed"}`;
          if (moved["confirmed"] === false) tone = "warning";
        } else
          label = `${text(object(p["field"])["name"])}: ${fieldValue(p["to"])} · ${p["movedBy"] === null ? "by a person" : `by ${text(moved["actorId"])}`}`;
      }
    }
    messages.push({
      id: e.eventId,
      at: time(e.consumedAt ?? e.receivedAt),
      from,
      to,
      label: pending ? `${label} · pending` : label,
      style,
      tone: pending ? "muted" : tone,
      ...(pass ? { pass: pass.number, tokens: pass.tokens, accounts: pass.accounts } : {}),
    });
  }
  for (const p of passes.filter((p) => p.running))
    messages.push({
      id: `running-${p.number}`,
      at:
        Math.max(
          p.start,
          ...messages.filter((m) => m.from === p.thread || m.to === p.thread).map((m) => m.at),
        ) + 0.001,
      from: p.thread,
      to: p.thread,
      label: "running",
      style: "note",
      tone: "primary",
      pass: p.number,
      tokens: p.tokens,
      accounts: p.accounts,
    });
  const unmatched =
    input.usage?.calls.filter(
      (c) =>
        !c.thread ||
        !passes.some(
          (p) =>
            p.thread === threadKey(c.thread!.environment, c.thread!.threadId) &&
            time(c.usedAt) >= p.start,
        ),
    ) ?? [];
  return {
    lifelines: [
      { id: "manifold", label: "Manifold" },
      ...[...threads].map(([id, label]) => ({ id, label })),
      { id: "github", label: "GitHub" },
    ],
    messages: messages.toSorted((a, b) => a.at - b.at),
    unattributed: totals(unmatched, input.usage?.accounts ?? []),
  };
}
