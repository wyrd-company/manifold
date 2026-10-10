// ---
// relationships:
//   implements: service-assembly
// ---
import type { ServiceLogEntry } from "./types.ts";
export function stderrLog(entry: ServiceLogEntry) {
  process.stderr.write(JSON.stringify({ time: new Date().toISOString(), ...entry }) + "\n");
}
