// ---
// relationships:
//   implements: actors-api
// ---
export const actorsApiPath = "/api/actors";
export interface ActorSummary {
  readonly actorId: string;
  readonly status: "active" | "done" | "stopped";
  readonly machine: string;
  readonly blueprint?: { readonly path: string; readonly commit: string };
  readonly states: readonly string[];
  readonly environment?: string;
  readonly project?: string;
  readonly issue?: string;
  readonly portfolioItem?: string;
  readonly savedAt: string;
}
export interface ActorsResponse {
  readonly actors: readonly ActorSummary[];
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === "string" && value.length > 0;
export function isActorsResponse(value: unknown): value is ActorsResponse {
  return (
    record(value) &&
    Object.keys(value).length === 1 &&
    Array.isArray(value["actors"]) &&
    value["actors"].every((actor) => {
      if (
        !record(actor) ||
        !nonempty(actor["actorId"]) ||
        !nonempty(actor["machine"]) ||
        !(
          actor["status"] === "active" ||
          actor["status"] === "done" ||
          actor["status"] === "stopped"
        ) ||
        !Array.isArray(actor["states"]) ||
        !actor["states"].every(nonempty) ||
        typeof actor["savedAt"] !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(actor["savedAt"]) ||
        !Number.isFinite(Date.parse(actor["savedAt"])) ||
        new Date(actor["savedAt"]).toISOString() !== actor["savedAt"]
      )
        return false;
      if (
        Object.keys(actor).some(
          (key) =>
            ![
              "actorId",
              "status",
              "machine",
              "blueprint",
              "states",
              "environment",
              "project",
              "issue",
              "portfolioItem",
              "savedAt",
            ].includes(key),
        )
      )
        return false;
      if (
        ["environment", "project", "issue", "portfolioItem"].some(
          (key) => key in actor && typeof actor[key] !== "string",
        )
      )
        return false;
      const blueprint = actor["blueprint"];
      return (
        !("blueprint" in actor) ||
        (record(blueprint) &&
          Object.keys(blueprint).length === 2 &&
          typeof blueprint["path"] === "string" &&
          /^blueprints\/.+\.ya?ml$/.test(blueprint["path"]) &&
          typeof blueprint["commit"] === "string" &&
          /^([0-9a-f]{40}|[0-9a-f]{64})$/.test(blueprint["commit"]))
      );
    })
  );
}
export type StateValue = string | { readonly [key: string]: StateValue };
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
export interface StateVisit {
  readonly visit: number;
  readonly value: StateValue;
  readonly states: readonly string[];
  readonly machine: string;
  readonly blueprint?: ActorSummary["blueprint"];
  readonly enteredAt: string;
  readonly exitedAt?: string;
  readonly exitEvent?: { readonly type: string; readonly eventId?: string };
}
export interface ReceivedEvent {
  readonly eventId: string;
  readonly type: string;
  readonly topic: string;
  readonly receivedAt: string;
  readonly consumedAt?: string;
  readonly visit?: number;
  readonly payload: JsonValue;
}
export interface ActorCommand {
  readonly commandId: string;
  readonly kind: "thread-create" | "turn-start";
  readonly environment: string;
  readonly threadId: string;
  readonly messageId?: string;
  readonly turnId?: string;
  readonly invokeId: string;
  readonly entryId: string;
  readonly sentAt: string;
  readonly acceptedAt?: string;
}
export interface ActorEnd {
  readonly status: "done" | "stopped";
  readonly endedAt: string;
  readonly output?: JsonValue;
}
export interface ActorHistory {
  readonly actor: ActorSummary;
  readonly visits: readonly StateVisit[];
  readonly events: readonly ReceivedEvent[];
  readonly commands: readonly ActorCommand[];
  readonly end?: ActorEnd;
}
export interface ActorHistoryResponse {
  readonly history: ActorHistory;
}
export const actorHistoryPath = (actorId: string) =>
  `${actorsApiPath}/${encodeURIComponent(actorId)}/history`;
const date = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const keys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));
const optional = (value: Record<string, unknown>, key: string, check: (v: unknown) => boolean) =>
  !(key in value) || check(value[key]);
const positive = (v: unknown) => Number.isInteger(v) && Number(v) >= 1;
const strings = (v: unknown) => Array.isArray(v) && v.every(nonempty);
function stateValue(v: unknown): v is StateValue {
  return nonempty(v) || (record(v) && Object.values(v).every(stateValue));
}
function json(v: unknown): v is JsonValue {
  return (
    v === null ||
    typeof v === "string" ||
    typeof v === "boolean" ||
    (typeof v === "number" && Number.isFinite(v)) ||
    (Array.isArray(v) ? v.every(json) : record(v) && Object.values(v).every(json))
  );
}
function blueprint(v: unknown) {
  return (
    record(v) &&
    keys(v, ["path", "commit"]) &&
    typeof v["path"] === "string" &&
    /^blueprints\/.+\.ya?ml$/.test(v["path"]) &&
    typeof v["commit"] === "string" &&
    /^([0-9a-f]{40}|[0-9a-f]{64})$/.test(v["commit"])
  );
}
function visit(v: unknown) {
  return (
    record(v) &&
    keys(v, [
      "visit",
      "value",
      "states",
      "machine",
      "blueprint",
      "enteredAt",
      "exitedAt",
      "exitEvent",
    ]) &&
    positive(v["visit"]) &&
    stateValue(v["value"]) &&
    strings(v["states"]) &&
    nonempty(v["machine"]) &&
    date(v["enteredAt"]) &&
    optional(v, "blueprint", blueprint) &&
    optional(v, "exitedAt", date) &&
    optional(
      v,
      "exitEvent",
      (e) =>
        record(e) &&
        keys(e, ["type", "eventId"]) &&
        nonempty(e["type"]) &&
        optional(e, "eventId", nonempty),
    )
  );
}
function received(v: unknown) {
  return (
    record(v) &&
    keys(v, ["eventId", "type", "topic", "receivedAt", "consumedAt", "visit", "payload"]) &&
    ["eventId", "type", "topic"].every((k) => nonempty(v[k])) &&
    date(v["receivedAt"]) &&
    optional(v, "consumedAt", date) &&
    optional(v, "visit", positive) &&
    record(v["payload"]) &&
    nonempty(v["payload"]["type"]) &&
    json(v["payload"])
  );
}
function sent(v: unknown) {
  return (
    record(v) &&
    keys(v, [
      "commandId",
      "kind",
      "environment",
      "threadId",
      "messageId",
      "turnId",
      "invokeId",
      "entryId",
      "sentAt",
      "acceptedAt",
    ]) &&
    ["commandId", "environment", "threadId", "invokeId", "entryId"].every((k) => nonempty(v[k])) &&
    (v["kind"] === "thread-create" || v["kind"] === "turn-start") &&
    date(v["sentAt"]) &&
    optional(v, "acceptedAt", date) &&
    optional(v, "messageId", nonempty) &&
    optional(v, "turnId", nonempty)
  );
}
export function isActorHistoryResponse(value: unknown): value is ActorHistoryResponse {
  if (!record(value) || Object.keys(value).length !== 1 || !record(value["history"])) return false;
  const h = value["history"];
  return (
    keys(h, ["actor", "visits", "events", "commands", "end"]) &&
    isActorsResponse({ actors: [h["actor"]] }) &&
    Array.isArray(h["visits"]) &&
    h["visits"].every(visit) &&
    Array.isArray(h["events"]) &&
    h["events"].every(received) &&
    Array.isArray(h["commands"]) &&
    h["commands"].every(sent) &&
    optional(
      h,
      "end",
      (e) =>
        record(e) &&
        keys(e, ["status", "endedAt", "output"]) &&
        (e["status"] === "done" || e["status"] === "stopped") &&
        date(e["endedAt"]) &&
        optional(e, "output", json),
    )
  );
}
