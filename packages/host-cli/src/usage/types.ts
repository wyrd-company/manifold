// ---
// relationships:
//   implements: usage-record
// ---
import type { UsageCall, UsageRecord } from "@wyrd-company/manifold-shared";
export type {
  UsageCall,
  UsageRecord,
  UsageProvider,
  UsageSourceError,
} from "@wyrd-company/manifold-shared";
import type { UsageProvider } from "@wyrd-company/manifold-shared";
export type UsageRoot = { provider: UsageProvider; path: string };
export type UsageUnit = UsageCall["unit"];
export type Source = { provider: UsageProvider; path: string; root: string };
export type LibraryCall = {
  model: string;
  sessionId: string;
  timestamp: string;
  deduplicationKey: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  cacheCreationOneHourTokens?: number;
  reasoningTokens: number;
  webSearchRequests: number;
  speed: "standard" | "fast";
  costIsEstimated?: boolean;
  arm?: "message" | "session-level";
};
export type UsageSourceStamp = {
  provider: UsageProvider;
  path: string;
  files: readonly { path: string; size: number; modifiedMs: number }[];
};
export type UsageBatch = { sources: readonly UsageSourceStamp[]; records: readonly UsageRecord[] };
