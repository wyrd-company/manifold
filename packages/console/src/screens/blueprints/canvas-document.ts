// ---
// relationships:
//   implements: operator-console
// ---
import { parseDocument } from "yaml";
export function canvasDocument(text: string): unknown {
  try {
    const document = parseDocument(text);
    return document.errors.length ? undefined : document.toJS();
  } catch {
    return undefined;
  }
}
