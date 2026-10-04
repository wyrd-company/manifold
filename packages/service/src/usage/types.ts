// ---
// relationships:
//   implements: usage-intake
// ---
import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  UsageFinding,
  UsagePushRequest,
  UsagePushResult,
  UsageTokens,
  UsageProvider,
} from "@wyrd-company/manifold-shared";
import type { Ledger, LedgerConnection } from "../ledger/index.ts";
import type { Portfolio } from "../portfolio/index.ts";
export interface UsageRevision {
  readonly commit: string;
  read(path: string): Promise<string | undefined>;
}
export interface UsageActorSave {
  readonly actorId: string;
  readonly snapshot: {
    readonly status: string;
    readonly value?: unknown;
    readonly context?: unknown;
  };
}
export type UsageApplyResult =
  | { status: "applied" | "unchanged"; commit: string }
  | { status: "rejected"; commit: string; findings: readonly UsageFinding[] };
export type UsageRetryResult = {
  posted: number;
  pending: { unaccounted: number; unpriced: number; noWindow: number };
};
export interface Usage {
  readonly listener: (request: IncomingMessage, response: ServerResponse) => void;
  push(request: UsagePushRequest): UsagePushResult;
  saveHook(save: UsageActorSave): void;
  apply(revision: UsageRevision): Promise<UsageApplyResult>;
  retryPending(): UsageRetryResult;
}
export type UsageOptions = {
  connection: LedgerConnection;
  ledger: Pick<Ledger, "postActual" | "settle">;
  portfolio: Pick<Portfolio, "t3codeProject">;
  threadProject(environment: string, threadId: string): string | undefined;
  environments: ReadonlySet<string>;
  now?: () => number;
  onError?: (error: unknown) => void;
};
export type Posting = {
  seq: number;
  environment: string;
  call_key: string;
  revision: number;
  used_at: number;
  provider: UsageProvider;
  model: string | null;
  speed: "standard" | "fast";
  base_tokens: string;
  tokens: string;
  actor: string;
  item: string;
  visit: number | null;
};
export const zeroTokens = (): UsageTokens => ({
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  cacheWriteOneHour: 0,
  reasoning: 0,
  webSearchRequests: 0,
});
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item !== null && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
}
