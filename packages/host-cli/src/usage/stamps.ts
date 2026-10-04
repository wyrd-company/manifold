// ---
// relationships:
//   implements: usage-decoder
// ---
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { walk, absent, SourceReadError } from "./source.ts";
import type { Source, UsageSourceStamp } from "./types.ts";
export async function sourceStamp(source: Source): Promise<UsageSourceStamp> {
  let files = [source.path];
  if (source.provider === "claude") files.push(source.path.replace(/\.jsonl$/, ".meta.json"));
  if (source.provider === "cursor")
    files.push(join(source.root, "ai-tracking", "ai-code-tracking.db"));
  if (source.provider === "grok") files = await walk(source.path);
  if (source.provider === "opencode" && !source.path.endsWith(".db"))
    files = [
      ...(await walk(join(source.root, "storage", "session"))),
      ...(await walk(join(source.root, "storage", "message"))),
      ...(await walk(join(source.root, "storage", "part"))),
    ];
  files = [
    ...new Set(
      files.flatMap((path) => (/\.(db|sqlite)$/.test(path) ? [path, path + "-wal"] : [path])),
    ),
  ].sort();
  const stamps: UsageSourceStamp["files"][number][] = [];
  for (const path of files)
    try {
      const info = await stat(path);
      stamps.push({ path, size: info.size, modifiedMs: info.mtimeMs });
    } catch (error) {
      if (!absent(error)) throw new SourceReadError();
    }
  return { provider: source.provider, path: source.path, files: stamps };
}
