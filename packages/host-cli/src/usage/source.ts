// ---
// relationships:
//   implements: usage-decoder
// ---
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { Source, UsageRoot, UsageSourceError } from "./types.ts";

export function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
export function absent(error: unknown): boolean {
  return object(error)["code"] === "ENOENT";
}
export class SourceReadError extends Error {
  readonly database: string | undefined;
  constructor(database?: string) {
    super();
    this.database = database;
  }
}
export class Problems {
  private readonly errors = new Map<UsageSourceError["code"], UsageSourceError>();
  private readonly source: Source;
  constructor(source: Source) {
    this.source = source;
  }
  add(code: UsageSourceError["code"], index?: number, path = this.source.path) {
    const previous = this.errors.get(code);
    if (previous) {
      previous.records++;
      return;
    }
    this.errors.set(code, {
      type: "source-error",
      provider: this.source.provider,
      source: path,
      code,
      records: 1,
      ...(index === undefined ? {} : { firstRecord: index }),
    });
  }
  records() {
    return [...this.errors.values()];
  }
}

async function walk(path: string, unreadable?: (path: string) => void): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (absent(error)) return [];
    if (!unreadable) throw new SourceReadError();
    unreadable(path);
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(child, unreadable)));
    else if (entry.isFile() || entry.isSymbolicLink()) files.push(child);
  }
  return files;
}

export async function discover(
  root: UsageRoot,
  unreadable: (path: string) => void,
): Promise<Source[]> {
  const path = resolve(root.path);
  let files: string[];
  switch (root.provider) {
    case "claude":
      files = (await walk(join(path, "projects"), unreadable)).filter((file) =>
        file.endsWith(".jsonl"),
      );
      break;
    case "codex":
      files = [
        ...(await walk(join(path, "sessions"), unreadable)),
        ...(await walk(join(path, "archived_sessions"), unreadable)),
      ].filter((file) => file.endsWith(".jsonl"));
      break;
    case "cursor":
      files = (await walk(join(path, "projects"), unreadable)).filter((file) =>
        /[/\\]agent-transcripts[/\\][^/\\]+\.(txt|jsonl)$/.test(file),
      );
      break;
    case "grok":
      files = (await walk(join(path, "sessions"), unreadable))
        .filter((file) => basename(file) === "summary.json")
        .map((file) => resolve(file, ".."));
      break;
    case "opencode": {
      const sessions = (await walk(join(path, "storage", "session"), unreadable)).filter((file) =>
        file.endsWith(".json"),
      );
      let entries: string[];
      try {
        entries = await readdir(path);
      } catch (error) {
        if (!absent(error)) unreadable(path);
        entries = [];
      }
      files = [
        ...sessions,
        ...entries.filter((name) => /^opencode.*\.db$/.test(name)).map((name) => join(path, name)),
      ];
      break;
    }
  }
  return files.sort().map((file) => ({ provider: root.provider, path: file, root: path }));
}
export { realpath, walk };
export async function modificationTime(path: string): Promise<Date> {
  try {
    return (await stat(path)).mtime;
  } catch {
    throw new SourceReadError();
  }
}

export async function read(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    throw new SourceReadError();
  }
}
export async function json(
  path: string,
  problems: Problems,
  optional = false,
): Promise<Record<string, unknown>> {
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if (optional && absent(error)) return {};
    throw new SourceReadError();
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return object(value);
  } catch {
    problems.add("malformed-record", 0);
    return {};
  }
}
export function jsonLines(
  raw: string,
  problems: Problems,
  classify: (
    value: Record<string, unknown>,
    index: number,
  ) => "valid" | "unknown-record" | "malformed-record",
): Record<string, unknown>[] {
  const lines = raw.split("\n");
  const records: Record<string, unknown>[] = [];
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      problems.add(
        index === lines.length - 1 && !raw.endsWith("\n") ? "truncated" : "malformed-record",
        index,
      );
      continue;
    }
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      problems.add("unknown-record", index);
      continue;
    }
    const record = object(value);
    const result = classify(record, index);
    if (result !== "valid") problems.add(result, index);
    else records.push(record);
  }
  return records;
}
export function validCounts(value: unknown): boolean {
  if (value === undefined) return true;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(object(value)).every((item) =>
    typeof item === "object" && item !== null
      ? validCounts(item)
      : typeof item === "number" && Number.isSafeInteger(item) && item >= 0,
  );
}

// Track only this source's changes, rather than copying every earlier call key.
export class DedupSet extends Set<string> {
  private readonly changes = new Map<string, boolean>();
  override add(key: string): this {
    if (!this.changes.has(key)) this.changes.set(key, this.has(key));
    return super.add(key);
  }
  override delete(key: string): boolean {
    if (!this.changes.has(key)) this.changes.set(key, this.has(key));
    return super.delete(key);
  }
  commit() {
    this.changes.clear();
  }
  rollback() {
    for (const [key, existed] of this.changes) {
      if (existed) super.add(key);
      else super.delete(key);
    }
    this.commit();
  }
}
