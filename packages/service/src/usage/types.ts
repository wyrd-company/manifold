// ---
// relationships:
//   implements: usage-intake
// ---
import type {
  UsageMoveRequest,
  UsageMoveResponse,
  UnownedEntry,
} from "@wyrd-company/manifold-shared/usage-api";
import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  UsageAccount,
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
export type UsagePricing = {
  overrides: number;
  unpriced: readonly { provider: UsageProvider; model: string | null; postings: number }[];
};
export interface Usage {
  lastUsedAt(): Readonly<Record<string, number>>;
  pricing(): UsagePricing;
  readonly listener: (request: IncomingMessage, response: ServerResponse) => void;
  unowned(): UnownedEntry[];
  move(request: UsageMoveRequest): UsageMoveResponse;
  push(request: UsagePushRequest): UsagePushResult;
  saveHook(save: UsageActorSave): void;
  apply(revision: UsageRevision): Promise<UsageApplyResult>;
  retryPending(): UsageRetryResult;
  accounts(): Readonly<Record<string, UsageAccount>>;
  actorUsage: Ledger["actorUsage"];
  actorVisitUsage(
    actor: string,
  ): import("@wyrd-company/manifold-shared/actor-usage-api").ActorUsageResponse;
}
export type UsageOptions = {
  connection: LedgerConnection;
  visits: Pick<import("../history/index.ts").History, "visits" | "visitAt">;
  ledger: Pick<Ledger, "postActual" | "settle" | "actorUsage" | "reattribute">;
  portfolio: Pick<Portfolio, "t3codeProject" | "current" | "usageItem">;
  threadProject(environment: string, threadId: string): string | undefined;
  threadTitle?(environment: string, threadId: string): string | undefined;
  inputChanged?: () => void;
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
  status: "pending" | "posted";
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
