// ---
// relationships:
//   implements: usage-decoder
//   references: usage-record
// ---
import type { LibraryCall, UsageCall, UsageProvider, UsageUnit } from "./types.ts";
export function normalize(
  provider: UsageProvider,
  unit: UsageUnit,
  call: LibraryCall,
  mtime: Date,
): UsageCall {
  const timestamp = new Date(call.timestamp);
  const invalidTime = !Number.isFinite(timestamp.getTime());
  const granularity =
    provider === "grok" || call.arm === "session-level" ? "session-total" : "call";
  return {
    type: "call",
    key:
      granularity === "session-total"
        ? `${provider}/${unit.id}/session-total`
        : `${provider}/${call.deduplicationKey}`,
    provider,
    providerSessionId: call.sessionId,
    unit,
    timestamp: (invalidTime ? mtime : timestamp).toISOString(),
    model: call.model || null,
    tokens: {
      input: call.inputTokens,
      output: call.outputTokens,
      cacheRead: call.cacheReadInputTokens,
      cacheWrite: call.cacheCreationInputTokens,
      cacheWriteOneHour: call.cacheCreationOneHourTokens ?? 0,
      reasoning: call.reasoningTokens,
      webSearchRequests: call.webSearchRequests,
    },
    speed: call.speed,
    granularity,
    estimated: Boolean(call.costIsEstimated) || provider === "cursor" || invalidTime,
  };
}
export function compareTotals(a: UsageCall, b: UsageCall): number {
  if (a.timestamp !== b.timestamp) return a.timestamp < b.timestamp ? -1 : 1;
  const av = Object.values(a.tokens),
    bv = Object.values(b.tokens);
  const sum =
    av.reduce((total, count) => total + count, 0) - bv.reduce((total, count) => total + count, 0);
  if (sum) return sum;
  for (const [i, count] of av.entries()) {
    const difference = count - bv[i]!;
    if (difference) return difference;
  }
  return 0;
}
