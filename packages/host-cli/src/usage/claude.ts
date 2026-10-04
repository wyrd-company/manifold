// ---
// relationships:
//   implements: usage-decoder
// ---
import {
  collectSessionMeta,
  emptySessionMeta,
  groupIntoTurns,
  dedupeStreamingMessageIds,
  type JournalEntry,
} from "@codeburn/core/providers/claude";
import { basename } from "node:path";
import { json, jsonLines, object, read, text, validCounts, type Problems } from "./source.ts";
import type { LibraryCall, Source, UsageUnit } from "./types.ts";

const recordTypes = new Set([
  "user",
  "assistant",
  "system",
  "progress",
  "attachment",
  "file-history-snapshot",
  "queue-operation",
  "summary",
  "ai-title",
  "pr-link",
  "last-prompt",
  "custom-title",
  "agent-name",
  "agent-color",
  "agent-setting",
  "bridge-status",
  "saved_hook_context",
  "change",
  "attribution-snapshot",
]);
export async function decodeClaude(
  source: Source,
  problems: Problems,
  seen: Set<string>,
  agentParents: Map<string, string>,
) {
  const records = jsonLines(await read(source.path), problems, (record) => {
    if (!recordTypes.has(String(record["type"]))) return "unknown-record";
    if (record["type"] === "assistant") {
      const message = object(record["message"]);
      const speed = object(message["usage"])["speed"];
      if (speed !== undefined && speed !== "standard" && speed !== "fast")
        return "malformed-record";
      if (
        !text(message["model"]) ||
        !text(message["id"]) ||
        !message["usage"] ||
        !validCounts(object(message["usage"])["cache_creation"]) ||
        !validCounts(object(message["usage"])["server_tool_use"]) ||
        !validCounts(
          Object.fromEntries(
            Object.entries(object(message["usage"])).filter(([key]) => key.endsWith("tokens")),
          ),
        )
      )
        return "malformed-record";
    }
    if (record["sessionId"] !== undefined && !text(record["sessionId"])) return "malformed-record";
    return "valid";
  }) as JournalEntry[];
  const meta = emptySessionMeta();
  for (const record of records) collectSessionMeta(record, meta);
  const subagent = /[/\\]subagents[/\\]/.test(source.path);
  const id = subagent
    ? (records.map((record) => text(record["agentId"])).find(Boolean) ??
      basename(source.path, ".jsonl").replace(/^agent-/, ""))
    : basename(source.path, ".jsonl");
  const parentId = agentParents.get(id) ?? meta.parentSessionId;
  const unit: UsageUnit = {
    id,
    kind: subagent ? "subagent" : "session",
    ...(subagent && parentId ? { parentId } : {}),
  };
  if (subagent) {
    const sidecar = await json(source.path.replace(/\.jsonl$/, ".meta.json"), problems, true);
    const name = text(sidecar["description"]),
      role = text(sidecar["agentType"]);
    if (name) unit.name = name;
    if (role) unit.role = role;
  }
  for (const agentId of Object.keys(meta.agentSpawnLinks)) agentParents.set(agentId, id);
  const turns = groupIntoTurns(dedupeStreamingMessageIds(records), seen);
  const calls: LibraryCall[] = turns.flatMap((turn) =>
    turn.assistantCalls.map((call) => ({
      ...call,
      ...call.usage,
      sessionId: turn.sessionId || records.map((record) => record.sessionId).find(Boolean) || id,
    })),
  );
  return [{ unit, calls }];
}
