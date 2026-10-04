// ---
// relationships:
//   implements: usage-record
// ---
export type UsageProvider = "claude" | "codex" | "cursor" | "grok" | "opencode";
export type UsageRoot = { provider: UsageProvider; path: string };
export type UsageUnit = {
  id: string;
  kind: "session" | "subagent" | "child-thread";
  parentId?: string;
  name?: string;
  role?: string;
};
export type UsageCall = {
  type: "call";
  key: string;
  provider: UsageProvider;
  providerSessionId: string;
  unit: UsageUnit;
  timestamp: string;
  model: string | null;
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    cacheWriteOneHour: number;
    reasoning: number;
    webSearchRequests: number;
  };
  speed: "standard" | "fast";
  granularity: "call" | "session-total";
  estimated: boolean;
};
export type UsageSourceError = {
  type: "source-error";
  provider: UsageProvider;
  source: string;
  code: "unreadable" | "truncated" | "malformed-record" | "unknown-record" | "decoder-failed";
  records: number;
  firstRecord?: number;
};
export type UsageRecord = UsageCall | UsageSourceError;
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
