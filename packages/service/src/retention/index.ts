// ---
// relationships:
//   implements: retention
// ---
export { openRetention } from "./retention.ts";
export type {
  RetentionOptions,
  RetentionClock,
  Retention,
  PruneResult,
  PruneStep,
} from "./types.ts";
