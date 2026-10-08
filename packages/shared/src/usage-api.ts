// ---
// relationships:
//   implements: usage-api
// ---
import { array, dateTime, natural, nonempty, oneOf, shape, string } from "./api-guards.ts";
export const usageUnownedPath = "/api/usage/unowned";
export const usageMovesPath = "/api/usage/moves";
export type UsageMoveRequest = { from: string; to: { item: string } | { actor: string } };
export type UsageMoveResponse = {
  status: "moved";
  from: string;
  to: { actor: string; item: string };
  moved: number;
  accounts: { account: string; amount: number }[];
};
export type UnownedEntry = {
  actor: string;
  kind: "thread" | "session";
  environment: string;
  threadId?: string;
  provider?: string;
  providerSessionId?: string;
  project?: string;
  title?: string;
  lastUsedAt: string;
  pending: number;
  usage: { item: string; account: string; amount: number; calls: number }[];
};
export type UsageUnownedResponse = { unowned: UnownedEntry[] };
export const isUnownedActor = (v: unknown): v is string =>
  string(v) && /^(thread:[^:]+:.+|session:[^:]+:[^:]+:.+)$/.test(v);
export function isUsageMoveRequest(v: unknown): v is UsageMoveRequest {
  return shape(v, {
    from: isUnownedActor,
    to: (v) => shape(v, { item: nonempty }) || shape(v, { actor: nonempty }),
  });
}
export function isUsageMoveResponse(v: unknown): v is UsageMoveResponse {
  return shape(v, {
    status: oneOf("moved"),
    from: isUnownedActor,
    to: (v) => shape(v, { actor: nonempty, item: nonempty }),
    moved: natural,
    accounts: array((v) => shape(v, { account: nonempty, amount: natural })),
  });
}
export function isUsageUnownedResponse(v: unknown): v is UsageUnownedResponse {
  return shape(v, {
    unowned: array((v) =>
      shape(
        v,
        {
          actor: isUnownedActor,
          kind: oneOf("thread", "session"),
          environment: nonempty,
          lastUsedAt: dateTime,
          pending: natural,
          usage: array((v) =>
            shape(v, {
              item: nonempty,
              account: nonempty,
              amount: natural,
              calls: (v) => natural(v) && Number(v) > 0,
            }),
          ),
        },
        {
          threadId: nonempty,
          provider: nonempty,
          providerSessionId: nonempty,
          project: nonempty,
          title: string,
        },
      ),
    ),
  });
}
