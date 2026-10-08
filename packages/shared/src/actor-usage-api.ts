// ---
// relationships:
//   implements: actor-usage-api
// ---
import { array, dateTime, natural, nonempty, shape, string } from "./api-guards.ts";
export const actorUsageApiPath = (actorId: string) =>
  `/api/usage/actors/${encodeURIComponent(actorId)}`;
export interface ActorTokens {
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
  readonly reasoning: number;
  readonly total: number;
}
export interface ActorActual {
  readonly account: string;
  readonly actual: number;
  readonly unit?: string;
}
export interface ActorUsageResponse {
  readonly actorId: string;
  readonly tokens: ActorTokens;
  readonly accounts: readonly ActorActual[];
  readonly visits: readonly {
    readonly visit: number;
    readonly enteredAt: string;
    readonly tokens: ActorTokens;
    readonly accounts: readonly ActorActual[];
  }[];
  readonly calls: readonly {
    readonly usedAt: string;
    readonly thread: { readonly environment: string; readonly threadId: string } | null;
    readonly visit: number | null;
    readonly total: number;
    readonly account: string | null;
    readonly actual: number | null;
  }[];
}
const tokens = (v: unknown) =>
  shape(v, {
    input: natural,
    output: natural,
    cacheRead: natural,
    cacheWrite: natural,
    reasoning: natural,
    total: natural,
  });
const actual = (v: unknown) => shape(v, { account: nonempty, actual: natural }, { unit: string });
export function isActorUsageResponse(v: unknown): v is ActorUsageResponse {
  return shape(v, {
    actorId: nonempty,
    tokens,
    accounts: array(actual),
    visits: array((v) =>
      shape(v, {
        visit: (v) => natural(v) && Number(v) > 0,
        enteredAt: dateTime,
        tokens,
        accounts: array((v) => shape(v, { account: nonempty, actual: natural })),
      }),
    ),
    calls: array((v) =>
      shape(v, {
        usedAt: dateTime,
        thread: (v) => v === null || shape(v, { environment: nonempty, threadId: nonempty }),
        visit: (v) => v === null || (natural(v) && Number(v) > 0),
        total: natural,
        account: (v) => v === null || nonempty(v),
        actual: (v) => v === null || natural(v),
      }),
    ),
  });
}
