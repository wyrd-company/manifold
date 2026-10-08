// ---
// relationships:
//   implements: operator-console
//   references: actors-api
// ---
// Structural stand-in for the approved history seam; replaced at rebase.
import { isActorsResponse } from "@wyrd-company/manifold-shared/actors-api";
import type { ActorSummary, ActorsResponse } from "@wyrd-company/manifold-shared/actors-api";
export interface StateVisit {
  readonly visit: number;
  readonly value: unknown;
  readonly states: readonly string[];
  readonly machine: string;
  readonly blueprint?: { readonly path: string; readonly commit: string };
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
  readonly payload: unknown;
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
  readonly output?: unknown;
}
export interface ActorHistory {
  readonly actor: ActorSummary & { readonly status: "active" | "done" | "stopped" };
  readonly visits: readonly StateVisit[];
  readonly events: readonly ReceivedEvent[];
  readonly commands: readonly ActorCommand[];
  readonly end?: ActorEnd;
}
export const actorHistoryPath = (id: string) => `/api/actors/${encodeURIComponent(id)}/history`;
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown) => typeof v === "string" && v.length > 0;
const date = (v: unknown) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString() === v;
const positive = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v > 0;
const optional = (v: Record<string, unknown>, k: string, g: (v: unknown) => boolean) =>
  !Object.hasOwn(v, k) || g(v[k]);
const blueprint = (v: unknown) =>
  record(v) &&
  typeof v["path"] === "string" &&
  /^blueprints\/.+\.ya?ml$/.test(v["path"]) &&
  typeof v["commit"] === "string" &&
  /^([a-f0-9]{40}|[a-f0-9]{64})$/.test(v["commit"]);
export function isActorHistoryResponse(v: unknown): v is { history: ActorHistory } {
  if (!record(v) || !record(v["history"])) return false;
  const h = v["history"],
    a = h["actor"];
  return (
    record(a) &&
    text(a["actorId"]) &&
    text(a["machine"]) &&
    ["active", "done", "stopped"].includes(String(a["status"])) &&
    Array.isArray(a["states"]) &&
    a["states"].every(text) &&
    date(a["savedAt"]) &&
    optional(a, "blueprint", blueprint) &&
    ["environment", "project", "issue", "portfolioItem"].every((k) =>
      optional(a, k, (v) => typeof v === "string"),
    ) &&
    Array.isArray(h["visits"]) &&
    h["visits"].every(
      (v) =>
        record(v) &&
        positive(v["visit"]) &&
        Object.hasOwn(v, "value") &&
        Array.isArray(v["states"]) &&
        v["states"].every(text) &&
        text(v["machine"]) &&
        date(v["enteredAt"]) &&
        optional(v, "exitedAt", date) &&
        optional(v, "blueprint", blueprint) &&
        optional(
          v,
          "exitEvent",
          (v) => record(v) && text(v["type"]) && optional(v, "eventId", text),
        ),
    ) &&
    Array.isArray(h["events"]) &&
    h["events"].every(
      (v) =>
        record(v) &&
        text(v["eventId"]) &&
        text(v["type"]) &&
        text(v["topic"]) &&
        date(v["receivedAt"]) &&
        Object.hasOwn(v, "payload") &&
        optional(v, "consumedAt", date) &&
        optional(v, "visit", positive),
    ) &&
    Array.isArray(h["commands"]) &&
    h["commands"].every(
      (v) =>
        record(v) &&
        ["thread-create", "turn-start"].includes(String(v["kind"])) &&
        ["commandId", "environment", "threadId", "invokeId", "entryId"].every((k) => text(v[k])) &&
        date(v["sentAt"]) &&
        optional(v, "acceptedAt", date) &&
        optional(v, "messageId", text) &&
        optional(v, "turnId", text),
    ) &&
    optional(
      h,
      "end",
      (v) => record(v) && ["done", "stopped"].includes(String(v["status"])) && date(v["endedAt"]),
    )
  );
}

/** Compatibility with the approved summary shape until its shared guard merges. */
export function isSeamActorsResponse(value: unknown): value is ActorsResponse {
  if (!record(value) || Object.keys(value).length !== 1 || !Array.isArray(value["actors"]))
    return false;
  const actors = value["actors"];
  return (
    actors.every((a) => record(a) && ["active", "done", "stopped"].includes(String(a["status"]))) &&
    isActorsResponse({
      actors: actors.map((a) => {
        const { status: _status, ...summary } = a as Record<string, unknown>;
        return summary;
      }),
    })
  );
}
