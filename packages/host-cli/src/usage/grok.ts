// ---
// relationships:
//   implements: usage-decoder
// ---
import { decodeGrok } from "@codeburn/core/providers/grok";
import { basename, join } from "node:path";
import { json, jsonLines, object, read, type Problems } from "./source.ts";
import type { Source, UsageUnit } from "./types.ts";

const updateTypes = new Set([
  "agent_message_chunk",
  "user_message_chunk",
  "agent_thought_chunk",
  "tool_call",
  "tool_call_update",
  "plan",
  "available_commands_update",
  "current_mode_update",
  "session_info_update",
  "config_option_update",
  "usage_update",
]);
export async function decodeGrokSource(source: Source, problems: Problems, seen: Set<string>) {
  const summary = await json(join(source.path, "summary.json"), problems);
  const signals = await json(join(source.path, "signals.json"), problems, true);
  if (
    [summary["current_model_id"], signals["primaryModelId"]].some(
      (value) => value !== undefined && typeof value !== "string",
    ) ||
    (signals["modelsUsed"] !== undefined &&
      (!Array.isArray(signals["modelsUsed"]) ||
        signals["modelsUsed"].some((value) => typeof value !== "string")))
  ) {
    problems.add("malformed-record", 0);
    return [];
  }
  const updates = jsonLines(await read(join(source.path, "updates.jsonl")), problems, (record) => {
    const params = object(record["params"]);
    const type = object(params["update"])["sessionUpdate"];
    if (!updateTypes.has(String(type))) return "unknown-record";
    const total = object(params["_meta"])["totalTokens"];
    if (
      total !== undefined &&
      (typeof total !== "number" || !Number.isSafeInteger(total) || total < 0)
    )
      return "malformed-record";
    return "valid";
  });
  const result = decodeGrok({
    records: [
      {
        summary,
        signals,
        updatesLines: updates.map((record) => JSON.stringify(record)),
        sourceDir: source.path,
        sessionName: basename(source.path),
        project: "",
      },
    ],
    context: { privacyKey: "", providerId: "grok", sourceRef: "" },
    seenKeys: seen,
  });
  return result.calls.map((call) => ({
    unit: { id: call.sessionId, kind: "session" } as UsageUnit,
    calls: [call],
  }));
}
