// ---
// relationships:
//   implements: actor-history
// ---
import type { ActorSave } from "../actor-host/index.ts";
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null)
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  return JSON.stringify(value)!;
}
export interface VisitRow {
  visit: number;
  machine: string;
  state_value: string;
  entered_at: number;
  exited_at: number | null;
  exit_event_type: string | null;
  exit_event_id: string | null;
}
export function visitChange(previous: VisitRow | undefined, save: ActorSave) {
  const value = canonical(save.snapshot["value"]);
  return {
    value,
    starts: !previous || previous.machine !== save.machine || previous.state_value !== value,
    ends: save.snapshot.status === "done" || save.snapshot.status === "stopped",
    visit: previous?.visit ?? 0,
  };
}
