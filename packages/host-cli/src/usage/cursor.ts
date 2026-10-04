// ---
// relationships:
//   implements: usage-decoder
// ---
import {
  decodeCursorAgent,
  type ConversationSummaryRow,
} from "@codeburn/core/providers/cursor-agent";
import { basename, extname, join } from "node:path";
import { stat } from "node:fs/promises";
import { sqlite } from "./sqlite.ts";
import { absent, jsonLines, object, read, SourceReadError, text, type Problems } from "./source.ts";
import type { Source, UsageUnit } from "./types.ts";

export async function decodeCursor(source: Source, problems: Problems, seen: Set<string>) {
  const conversationId = basename(source.path, extname(source.path));
  const mtime = (await stat(source.path)).mtime.toISOString();
  const database = join(source.root, "ai-tracking", "ai-code-tracking.db");
  let summary: ConversationSummaryRow | null = null;
  let databasePresent = false;
  try {
    await stat(database);
    databasePresent = true;
  } catch (error) {
    if (!absent(error)) throw new SourceReadError();
  }
  if (databasePresent)
    summary = sqlite(database, (db) => {
      const row = db
        .prepare(
          "SELECT conversationId, model, title, updatedAt FROM conversation_summaries WHERE conversationId = ?",
        )
        .get(conversationId);
      return row
        ? {
            conversationId,
            model: text(row["model"]) ?? null,
            title: text(row["title"]) ?? null,
            updatedAt: text(row["updatedAt"]) ?? null,
          }
        : null;
    });
  let transcript = await read(source.path);
  if (source.path.endsWith(".jsonl"))
    transcript = jsonLines(transcript, problems, (record) => {
      if (record["role"] !== "user" && record["role"] !== "assistant") return "unknown-record";
      return object(record["message"])["content"] === undefined ? "malformed-record" : "valid";
    })
      .map((record) => JSON.stringify(record))
      .join("\n");
  const result = decodeCursorAgent({
    records: [
      { summary, transcript, transcriptPath: source.path, fileMtime: mtime, conversationId },
    ],
    context: { privacyKey: "", providerId: "cursor", sourceRef: "" },
    seenKeys: seen,
  });
  for (const diagnostic of result.diagnostics)
    problems.add(
      diagnostic.code === "unknown-shape" ? "unknown-record" : "malformed-record",
      diagnostic.index,
    );
  const unit: UsageUnit = { id: conversationId, kind: "session" };
  return [{ unit, calls: result.calls }];
}
