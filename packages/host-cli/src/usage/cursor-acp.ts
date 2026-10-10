// ---
// relationships:
//   implements: usage-decoder
//   references: t3code-session-mapping
// ---
import { basename, dirname } from "node:path";
import { sqlite } from "./sqlite.ts";
import { object, text, type Problems } from "./source.ts";
import type { LibraryCall, Source } from "./types.ts";

type Field = { number: number; value: number | bigint | Uint8Array };
// A complete wire record is required: unknown or truncated wire types cannot
// silently look like an empty state. Lengths never allocate buffers.
function wire(bytes: Uint8Array): Field[] | undefined {
  let offset = 0;
  const fields: Field[] = [];
  const varint = () => {
    let value = 0n;
    for (let shift = 0n; shift < 70n && offset < bytes.length; shift += 7n) {
      const byte = bytes[offset++]!;
      if (shift === 63n && byte > 1) return undefined;
      value |= BigInt(byte & 127) << shift;
      if (byte < 128) return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value;
    }
    return undefined;
  };
  while (offset < bytes.length) {
    const tag = varint();
    if (typeof tag !== "number" || Math.floor(tag / 8) === 0) return;
    const number = Math.floor(tag / 8),
      type = tag % 8;
    if (type === 0) {
      const value = varint();
      if (value === undefined) return;
      fields.push({ number, value });
    } else {
      const length = type === 2 ? varint() : type === 1 ? 8 : type === 5 ? 4 : undefined;
      if (typeof length !== "number" || length > bytes.length - offset) return;
      fields.push({ number, value: bytes.subarray(offset, offset + length) });
      offset += length;
    }
  }
  return fields;
}
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");
const time = (fields: readonly Field[], number: number) => {
  const value = fields.find((f) => f.number === number)?.value;
  return typeof value === "number" && Number.isFinite(new Date(value).getTime())
    ? value
    : undefined;
};
const binary = (fields: readonly Field[], number: number) => {
  const value = fields.find((f) => f.number === number)?.value;
  return value instanceof Uint8Array ? value : undefined;
};
export function decodeCursorStore(source: Source, problems: Problems, seen: Set<string>) {
  const session = basename(dirname(source.path));
  const rows = sqlite(source.path, (db) =>
    db.prepare("SELECT id, data FROM blobs ORDER BY id").all(),
  );
  const messages = new Map<string, { index: number; message: Record<string, unknown> }>();
  const states: { id: string; refs: string[]; at: number }[] = [];
  const tools = new Map<string, { start: number; end: number }[]>();
  const opaque: { id: string; index: number }[] = [];
  const references = new Set<string>();
  const ids = new Set(rows.map((row) => String(row["id"])));
  for (const [index, row] of rows.entries()) {
    const id = String(row["id"]);
    const raw = row["data"];
    const bytes =
      typeof raw === "string"
        ? Buffer.from(raw)
        : raw instanceof Uint8Array
          ? raw
          : new Uint8Array();
    // Content references can occur in either JSON text or wire bytes.
    const rawText = Buffer.from(bytes).toString("utf8");
    for (const match of rawText.matchAll(/[0-9a-f]{64}/g))
      if (ids.has(match[0])) references.add(match[0]);
    for (let offset = 0; offset + 32 <= bytes.length; offset++) {
      const candidate = hex(bytes.subarray(offset, offset + 32));
      if (ids.has(candidate)) references.add(candidate);
    }
    let json: unknown;
    try {
      json = JSON.parse(rawText);
    } catch {
      /* Try the wire format next. */
    }
    if (json !== null && typeof json === "object" && !Array.isArray(json)) {
      const message = object(json);
      if (!["system", "user", "assistant", "tool"].includes(String(message["role"])))
        problems.add("unknown-record", index);
      else if (message["role"] === "assistant" && !Array.isArray(message["content"]))
        problems.add("malformed-record", index);
      else messages.set(id, { index, message });
      continue;
    }
    const fields = wire(bytes);
    if (!fields) {
      opaque.push({ id, index });
      continue;
    }
    const refs = fields
      .filter((f) => f.number === 1 && f.value instanceof Uint8Array && f.value.length === 32)
      .map((f) => hex(f.value as Uint8Array));
    if (fields.some((f) => f.number === 26)) {
      const at = time(fields, 26);
      if (at === undefined) problems.add("unknown-record", index);
      else if (refs.length && fields.filter((f) => f.number === 1).length === refs.length) {
        if (refs.some((ref) => !ids.has(ref))) problems.add("malformed-record", index);
        else states.push({ id, refs, at });
      }
    } else if (fields.length === 1 && fields[0]!.number === 2) {
      const nested = binary(fields, 2),
        tool = nested && wire(nested);
      const identifier = tool && binary(tool, 57);
      const start = tool && time(tool, 59),
        end = tool && time(tool, 60);
      if (!identifier || start === undefined || end === undefined)
        problems.add("unknown-record", index);
      else {
        const key = Buffer.from(identifier).toString("utf8");
        const records = tools.get(key) ?? [];
        records.push({ start, end });
        tools.set(key, records);
      }
    } else if (!fields.length || fields.some((f) => f.number < 1 || f.number > 5))
      problems.add("unknown-record", index);
  }
  for (const blob of opaque)
    if (!references.has(blob.id)) problems.add("malformed-record", blob.index);
  const toolTimes = (message: Record<string, unknown>, index?: number) => {
    const result: { start: number; end: number }[] = [];
    for (const part of message["content"] as unknown[]) {
      const fields = object(part);
      if (fields["type"] !== "tool-call") continue;
      const entries = tools.get(String(fields["toolCallId"]));
      if (!entries && index !== undefined) problems.add("unknown-record", index);
      if (entries) result.push(...entries);
    }
    return result;
  };
  const calls: LibraryCall[] = [];
  for (const [id, { index, message }] of messages) {
    if (message["role"] !== "assistant") continue;
    const own = toolTimes(message, index);
    let at: number | undefined;
    if (own.length) at = Math.min(...own.map((t) => t.start));
    else {
      const anchor = states
        .filter((state) => {
          const position = state.refs.indexOf(id);
          return (
            position >= 0 &&
            !state.refs
              .slice(position + 1)
              .some((ref) => messages.get(ref)?.message["role"] === "assistant")
          );
        })
        .sort(
          (a, b) => a.refs.length - b.refs.length || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
        )[0];
      if (anchor) {
        const ends = anchor.refs.slice(0, anchor.refs.indexOf(id)).flatMap((ref) => {
          const previous = messages.get(ref)?.message;
          return previous?.["role"] === "assistant" ? toolTimes(previous).map((t) => t.end) : [];
        });
        at = ends.length ? Math.max(...ends) : anchor.at;
      }
    }
    if (at === undefined) {
      problems.add("malformed-record", index);
      continue;
    }
    const key = `${session}/${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const model = (message["content"] as unknown[])
      .map((part) => text(object(object(object(part)["providerOptions"])["cursor"])["modelName"]))
      .find((value) => value !== undefined);
    calls.push({
      model: model ?? "",
      sessionId: session,
      timestamp: new Date(at).toISOString(),
      deduplicationKey: key,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      reasoningTokens: 0,
      webSearchRequests: 0,
      speed: "standard",
      costIsEstimated: own.length === 0,
    });
  }
  return [{ unit: { id: session, kind: "session" as const }, calls }];
}
