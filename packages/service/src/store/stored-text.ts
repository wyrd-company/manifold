// ---
// relationships:
//   implements: store
// ---
import type { SQLOutputValue } from "node:sqlite";
export function storedText(value: SQLOutputValue): string {
  if (!(value instanceof Uint8Array)) throw new TypeError("Stored text must be read as bytes");
  return Buffer.from(value).toString("utf8");
}
