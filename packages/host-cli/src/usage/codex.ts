// ---
// relationships:
//   implements: usage-decoder
// ---
import { decodeCodex } from "@codeburn/core/providers/codex";
import { basename } from "node:path";
import { jsonLines, object, read, text, validCounts, type Problems } from "./source.ts";
import type { Source, UsageUnit } from "./types.ts";

const recordTypes = new Set(["session_meta", "turn_context", "response_item", "event_msg"]);
export function codexIdentity(records: Record<string, unknown>[], fallback: string) {
  const payload = object(records.find((record) => record["type"] === "session_meta")?.["payload"]);
  const spawn = object(object(object(payload["source"])["subagent"])["thread_spawn"]);
  const id = text(payload["id"]) ?? text(payload["session_id"]) ?? fallback;
  const parentId = text(payload["parent_thread_id"]) ?? text(spawn["parent_thread_id"]);
  const name = text(payload["agent_nickname"]) ?? text(spawn["agent_nickname"]);
  const role = text(payload["agent_role"]) ?? text(spawn["agent_role"]);
  const unit: UsageUnit = {
    id,
    kind: parentId ? "child-thread" : "session",
    ...(parentId ? { parentId } : {}),
    ...(name ? { name } : {}),
    ...(role ? { role } : {}),
  };
  return { unit, origin: text(payload["forked_from_id"]) ?? parentId };
}
export async function orderCodex(sources: Source[]): Promise<Source[]> {
  const identities = await Promise.all(
    sources.map(async (source) => {
      try {
        const record = (await read(source.path))
          .split("\n")
          .flatMap((line) => {
            try {
              return [object(JSON.parse(line))];
            } catch {
              return [];
            }
          })
          .find((record) => record["type"] === "session_meta");
        return codexIdentity(record ? [record] : [], source.path);
      } catch {
        return undefined;
      }
    }),
  );
  const remaining = [...sources.keys()];
  const emitted = new Set<number>();
  const ordered: Source[] = [];
  while (remaining.length) {
    const ready = remaining.findIndex((index) => {
      const origin = identities[index]?.origin;
      return (
        !origin ||
        !identities.some((identity, parent) => identity?.unit.id === origin && !emitted.has(parent))
      );
    });
    if (ready === -1) {
      ordered.push(...remaining.map((index) => sources[index]!));
      break;
    }
    const [index] = remaining.splice(ready, 1);
    emitted.add(index!);
    ordered.push(sources[index!]!);
  }
  return ordered;
}
export async function decodeRollout(source: Source, problems: Problems, seen: Set<string>) {
  const records = jsonLines(await read(source.path), problems, (record) => {
    if (!recordTypes.has(String(record["type"]))) return "unknown-record";
    if (!record["payload"] || typeof record["payload"] !== "object") return "malformed-record";
    const payload = object(record["payload"]);
    const info = object(payload["info"]);
    if (
      [payload["model"], info["model"], info["model_name"], payload["session_id"]].some(
        (value) => value !== undefined && typeof value !== "string",
      )
    )
      return "malformed-record";
    if (!validCounts(info["last_token_usage"]) || !validCounts(info["total_token_usage"]))
      return "malformed-record";
    return "valid";
  });
  const { unit } = codexIdentity(records, basename(source.path, ".jsonl"));
  const decoded = decodeCodex({
    context: { privacyKey: "", providerId: "codex", sourceRef: "" },
    records: records.map((record) => JSON.stringify(record)),
    seenKeys: seen,
    sessionIdFallback: unit.id,
  });
  return [{ unit, calls: decoded.calls }];
}
