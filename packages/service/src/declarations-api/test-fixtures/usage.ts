// ---
// relationships:
//   verifies: [declarations-api, usage-intake]
// ---
import type { UsageCall } from "@wyrd-company/manifold-shared";
export function sampleCall(key: string, session: string): UsageCall {
  return {
    type: "call",
    key,
    provider: "codex",
    providerSessionId: session,
    unit: { id: session, kind: "session" },
    timestamp: "2026-01-01T00:00:01.000Z",
    model: "model-a",
    tokens: {
      input: 1,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cacheWriteOneHour: 0,
      reasoning: 0,
      webSearchRequests: 0,
    },
    speed: "standard",
    granularity: "call",
    estimated: false,
  };
}
