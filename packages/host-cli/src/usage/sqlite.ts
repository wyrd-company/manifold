// ---
// relationships:
//   implements: usage-decoder
// ---
import { DatabaseSync } from "node:sqlite";
import { SourceReadError, object, text } from "./source.ts";

export function sqlite<T>(path: string, query: (db: DatabaseSync) => T): T {
  let db;
  try {
    db = new DatabaseSync(path, { readOnly: true });
    return query(db);
  } catch {
    throw new SourceReadError(path);
  } finally {
    db?.close();
  }
}
export function blob(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) return Buffer.from(value).toString("utf8");
  return "";
}
export function sessionModel(value: unknown): string | undefined {
  const raw = blob(value);
  if (!raw) return undefined;
  try {
    const model = object(JSON.parse(raw));
    const id = text(model["modelID"]),
      provider = text(model["providerID"]);
    return id && provider ? `${provider}/${id}` : id;
  } catch {
    return raw;
  }
}
