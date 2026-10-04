// ---
// relationships:
//   implements: usage-intake
//   references: t3code-session-mapping
// ---
import { statSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { UsageMapping, UsageProvider } from "@wyrd-company/manifold-shared";
export function readSessionMappings(databasePath: string): UsageMapping[] {
  try {
    statSync(databasePath);
  } catch (error) {
    if (error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT")
      return [];
    throw error;
  }
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const mappings: UsageMapping[] = [];
    for (const row of db
      .prepare(
        "SELECT thread_id,provider_name,provider_instance_id,resume_cursor_json FROM provider_session_runtime",
      )
      .all()) {
      let cursor: unknown;
      try {
        cursor = JSON.parse(String(row["resume_cursor_json"]));
      } catch {
        continue;
      }
      if (cursor === null || typeof cursor !== "object" || Array.isArray(cursor)) continue;
      const fields = cursor as Record<string, unknown>;
      const providerName = row["provider_name"];
      const provider: UsageProvider | undefined =
        providerName === "claudeAgent"
          ? "claude"
          : providerName === "codex" ||
              providerName === "cursor" ||
              providerName === "grok" ||
              providerName === "opencode"
            ? providerName
            : undefined;
      const session =
        provider === "claude"
          ? typeof fields["resume"] === "string" && fields["resume"]
            ? fields["resume"]
            : fields["sessionId"]
          : provider === "codex"
            ? fields["threadId"]
            : fields["sessionId"];
      if (
        !provider ||
        typeof session !== "string" ||
        !session ||
        typeof row["thread_id"] !== "string" ||
        !row["thread_id"]
      )
        continue;
      mappings.push({
        provider,
        providerSessionId: session,
        threadId: row["thread_id"],
        ...(typeof row["provider_instance_id"] === "string" && row["provider_instance_id"]
          ? { providerInstance: row["provider_instance_id"] }
          : {}),
      });
    }
    return mappings;
  } finally {
    db.close();
  }
}
