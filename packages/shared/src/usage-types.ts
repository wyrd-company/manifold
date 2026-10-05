// ---
// relationships:
//   implements: [usage-record, usage-push, accounts-declaration, price-table]
// ---
export type UsageProvider = "claude" | "codex" | "cursor" | "grok" | "opencode";
export type UsageTokens = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cacheWriteOneHour: number;
  reasoning: number;
  webSearchRequests: number;
};
export type UsageCall = {
  type: "call";
  key: string;
  provider: UsageProvider;
  providerSessionId: string;
  unit: {
    id: string;
    kind: "session" | "subagent" | "child-thread";
    parentId?: string;
    name?: string;
    role?: string;
  };
  timestamp: string;
  model: string | null;
  tokens: UsageTokens;
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
  detail?: string;
};
export type UsageRecord = UsageCall | UsageSourceError;
export type UsageMapping = {
  provider: UsageProvider;
  providerSessionId: string;
  threadId: string;
  providerInstance?: string;
};
export type UsagePushRequest = {
  environment: string;
  threads: readonly UsageMapping[];
  records: readonly UsageRecord[];
};
export type UsagePushResult = {
  calls: { accepted: number; pending: number; replayed: number };
  threads: { accepted: number; replayed: number; conflicting: number };
  sourceErrors: number;
};
export type UsagePriceSet = {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
  cacheWriteOneHour?: number;
  reasoning?: number;
  webSearchRequest?: number;
};
export type UsagePriceEntry = {
  aliases?: readonly string[];
  standard: UsagePriceSet;
  fast?: UsagePriceSet;
};
export type PriceTable = { unit: "usd"; models: Record<string, UsagePriceEntry> };
export type UsageAccount = {
  unit: "usd";
  kind: "api" | "subscription";
  capacity: {
    amount: number;
    reset: string;
    every: { hours: number } | { days: number } | { months: number };
  };
  usage?: readonly { environment: string; provider: UsageProvider; instance?: string }[];
};
export type UsageDeclaration = { accounts: Record<string, UsageAccount>; prices: PriceTable };
export type UsageFinding = {
  file: "accounts" | "prices";
  kind: "syntax" | "schema" | "duplicate-usage" | "duplicate-model" | "invalid-capacity";
  location: string;
  message: string;
};
export type UsageLintResult =
  | { ok: true; declaration: UsageDeclaration }
  | { ok: false; findings: readonly UsageFinding[] };
