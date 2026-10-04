// ---
// relationships:
//   implements: t3code-environment-source
// ---
import type { BackoffPolicy } from "@wyrd-company/t3code-client";
export function retryDelay(policy: BackoffPolicy, attempt: number, random: number) {
  const base = Math.min(policy.maxMs, policy.initialMs * policy.factor ** attempt);
  const spread = base * (policy.jitter ?? 0);
  return Math.min(policy.maxMs, Math.max(0, Math.round(base - spread / 2 + random * spread)));
}
