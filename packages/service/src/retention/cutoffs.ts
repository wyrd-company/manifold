// ---
// relationships:
//   implements: retention
// ---
import type { RetentionConfiguration, RetentionWindow } from "../service-configuration/index.ts";
const cutoff = (window: RetentionWindow, at: number) =>
  window === "forever" ? undefined : at - window * 86400000;
export function cutoffs(configuration: RetentionConfiguration, at: number) {
  return {
    history: cutoff(configuration.historyDays, at),
    gates: cutoff(configuration.gateEvaluationDays, at),
    source: (source: string) =>
      cutoff(configuration.sourceEventDays[source] ?? configuration.sourceEventDays.default, at),
  };
}
