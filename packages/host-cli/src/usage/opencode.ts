// ---
// relationships:
//   implements: usage-decoder
// ---
import {
  decodeOpenCodeSession,
  type FileMessageData,
  type OpenCodeSessionEnvelope,
  type OpenCodeSessionTokens,
} from "@codeburn/core/providers/opencode-session";
import { basename, join } from "node:path";
import { blob, sessionModel, sqlite } from "./sqlite.ts";
import { json, object, read, text, validCounts, walk, type Problems } from "./source.ts";
import type { LibraryCall, Source, UsageUnit } from "./types.ts";

type Group = { unit: UsageUnit; calls: LibraryCall[] };
function unitFor(meta: Record<string, unknown>, fallback: string): UsageUnit {
  const id = text(meta["id"]) ?? fallback,
    parentId = text(meta["parent_id"]) ?? text(meta["parentID"]),
    name = text(meta["title"]);
  return {
    id,
    kind: parentId ? "subagent" : "session",
    ...(parentId ? { parentId } : {}),
    ...(name ? { name } : {}),
  };
}
function rootId(unit: UsageUnit, units: UsageUnit[]): string {
  let current = unit;
  const visited = new Set<string>();
  while (current.parentId && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = units.find((parent) => parent.id === current.parentId);
    if (!parent) return current.parentId;
    current = parent;
  }
  return current.id;
}
function messageValid(data: Record<string, unknown>, problems: Problems, index: number): boolean {
  if (!["user", "assistant", "model"].includes(String(data["role"]))) {
    problems.add("unknown-record", index);
    return false;
  }
  if (!validCounts(data["tokens"]) || !validCounts(data["usage"])) {
    problems.add("malformed-record", index);
    return false;
  }
  if (
    [data["modelID"], data["model"]].some(
      (value) => value !== undefined && typeof value !== "string",
    )
  )
    problems.add("malformed-record", index);
  return true;
}
function parseBlob(
  raw: string,
  problems: Problems,
  index: number,
): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(raw);
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      problems.add("unknown-record", index);
      return undefined;
    }
    return object(value);
  } catch {
    problems.add("malformed-record", index);
    return undefined;
  }
}
const partTypes = new Set([
  "text",
  "reasoning",
  "tool",
  "tool-call",
  "tool_call",
  "tool-result",
  "tool_result",
  "file",
  "step-start",
  "step-finish",
  "snapshot",
  "patch",
  "agent",
  "subtask",
  "retry",
  "compaction",
]);
function partValid(raw: string, problems: Problems, index: number): boolean {
  const data = parseBlob(raw, problems, index);
  if (!data) return false;
  if (!partTypes.has(String(data["type"]))) {
    problems.add("unknown-record", index);
    return false;
  }
  return true;
}
function decodeEnvelope(
  envelope: OpenCodeSessionEnvelope,
  unit: UsageUnit,
  problems: Problems,
  seen: Set<string>,
): Group {
  // Totals must compete across copies even when a previous copy used the same library key.
  if (
    envelope.kind === "sqlite" &&
    envelope.sessionTokens &&
    (envelope.sessionTokens.input > 0 ||
      envelope.sessionTokens.output > 0 ||
      envelope.sessionTokens.cost > 0)
  ) {
    // Core's fallback means no decoded message, not no NEW message. Probe before dedup.
    const probe = decodeOpenCodeSession({
      records: [envelope],
      context: { privacyKey: "", providerId: "opencode", sourceRef: "" },
    });
    if (probe.calls.some((call) => call.arm === "message"))
      envelope = { ...envelope, sessionTokens: null };
  }
  const totalKey = `opencode:${envelope.sessionId}:session-level`;
  seen.delete(totalKey);
  const result = decodeOpenCodeSession({
    records: [envelope],
    context: { privacyKey: "", providerId: "opencode", sourceRef: "" },
    seenKeys: seen,
  });
  for (const diagnostic of result.diagnostics)
    problems.add(
      diagnostic.code === "unknown-shape" ? "unknown-record" : "malformed-record",
      diagnostic.index,
    );
  return { unit, calls: result.calls };
}
export async function openCodeFileUnits(sources: Source[]): Promise<UsageUnit[]> {
  const units = await Promise.all(
    sources
      .filter((source) => !source.path.endsWith(".db"))
      .map(async (source) => {
        try {
          return unitFor(
            object(JSON.parse(await read(source.path))),
            basename(source.path, ".json"),
          );
        } catch {
          return undefined;
        }
      }),
  );
  return units.filter((unit) => unit !== undefined);
}
export async function decodeOpenCode(
  source: Source,
  problems: Problems,
  seen: Set<string>,
  fileUnits: UsageUnit[],
): Promise<Group[]> {
  if (!source.path.endsWith(".db")) {
    const meta = await json(source.path, problems);
    const unit = unitFor(meta, basename(source.path, ".json"));
    const messageFiles = (await walk(join(source.root, "storage", "message", unit.id)))
      .filter((path) => path.endsWith(".json"))
      .sort();
    const messages: { id: string; data: FileMessageData }[] = [];
    const partsRawByMessageId = new Map<string, string[]>();
    for (const [index, path] of messageFiles.entries()) {
      const data = parseBlob(await read(path), problems, index);
      if (!data || !messageValid(data, problems, index)) continue;
      const id = text(data["id"]) ?? basename(path, ".json");
      messages.push({ id, data: data as FileMessageData });
      const parts: string[] = [];
      for (const part of (await walk(join(source.root, "storage", "part", id)))
        .filter((path) => path.endsWith(".json"))
        .sort()) {
        const raw = await read(part);
        if (partValid(raw, problems, index)) parts.push(raw);
      }
      partsRawByMessageId.set(id, parts);
    }
    return [
      decodeEnvelope(
        {
          kind: "file",
          sessionId: rootId(unit, fileUnits),
          messages,
          partsRawByMessageId,
          metaTimeCreatedMs:
            typeof object(meta["time"])["created"] === "number"
              ? (object(meta["time"])["created"] as number)
              : undefined,
        },
        unit,
        problems,
        seen,
      ),
    ];
  }
  const rows = sqlite(source.path, (db) => ({
    sessions: db
      .prepare("SELECT id, parent_id, title, time_created FROM session ORDER BY time_created, id")
      .all(),
    messages: db
      .prepare("SELECT id, session_id, time_created, data FROM message ORDER BY time_created, id")
      .all(),
    parts: db.prepare("SELECT message_id, data FROM part ORDER BY id").all(),
    allSessions: db.prepare("SELECT * FROM session").all(),
  }));
  const units = rows.sessions.map((row) => unitFor(row, ""));
  return units.map((unit) => {
    const messages: Extract<OpenCodeSessionEnvelope, { kind: "sqlite" }>["messages"] = [];
    for (const [index, row] of rows.messages.entries()) {
      if (row["session_id"] !== unit.id) continue;
      const raw = blob(row["data"]),
        data = parseBlob(raw, problems, index);
      if (!data || !messageValid(data, problems, index)) continue;
      messages.push({
        session_id: unit.id,
        id: String(row["id"]),
        time_created: Number(row["time_created"]),
        data: raw,
      });
    }
    const parts = rows.parts
      .filter((row) => messages.some((message) => message.id === row["message_id"]))
      .flatMap((row, index) => {
        const raw = blob(row["data"]);
        return partValid(raw, problems, index)
          ? [{ message_id: String(row["message_id"]), data: raw }]
          : [];
      });
    const session = rows.allSessions.find((row) => row["id"] === unit.id)!;
    let sessionTokens: OpenCodeSessionTokens | null = null;
    if ("tokens_input" in session) {
      const values = {
        input: session["tokens_input"] ?? 0,
        output: session["tokens_output"] ?? 0,
        reasoning: session["tokens_reasoning"] ?? 0,
        cacheRead: session["tokens_cache_read"] ?? 0,
        cacheWrite: session["tokens_cache_write"] ?? 0,
      };
      if (validCounts(values))
        sessionTokens = {
          ...(values as Omit<OpenCodeSessionTokens, "model" | "cost">),
          cost: Number(session["cost"] ?? 0),
          model: sessionModel(session["model"]),
        };
      else
        problems.add(
          "malformed-record",
          rows.sessions.findIndex((row) => row["id"] === unit.id),
        );
    }
    return decodeEnvelope(
      { kind: "sqlite", sessionId: rootId(unit, units), messages, parts, sessionTokens },
      unit,
      problems,
      seen,
    );
  });
}
