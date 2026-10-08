// ---
// relationships:
//   implements: portfolio-api
// ---
import {
  array,
  boolean,
  dateTime,
  integer,
  natural,
  nonempty,
  oneOf,
  shape,
  string,
} from "./api-guards.ts";
export const portfolioApiPath = "/api/portfolio";
import type { PortfolioWarning } from "./allocated-accounts.ts";
export type { PortfolioWarning } from "./allocated-accounts.ts";
export interface PortfolioAccount {
  readonly name: string;
  readonly declared: boolean;
  readonly archived?: boolean;
  readonly lastUsedAt?: string;
  readonly unit?: "usd";
  readonly kind?: "api" | "subscription";
  readonly capacity?: {
    readonly amount: number;
    readonly reset: string;
    readonly every: { hours: number } | { days: number } | { months: number };
  };
  readonly window?: {
    readonly key: string;
    readonly opensAt: string;
    readonly closesAt: string;
    readonly capacity: number;
    readonly used: number;
  };
}
export interface PortfolioAllocation {
  readonly account: string;
  readonly declared: boolean;
  readonly guarantee: number;
  readonly ceiling?: number;
  readonly weight?: number;
  readonly pacing?: { readonly burst: number };
  readonly amount: number;
  readonly actual: number;
  readonly outstanding: number;
  readonly available: number;
  readonly reservable: number;
  readonly lifetime: number;
}
export interface PortfolioUnallocated {
  readonly account: string;
  readonly percent: number;
  readonly amount: number;
}
export interface PortfolioItem {
  readonly id: string;
  readonly parent: string | null;
  readonly title: string;
  readonly other: boolean;
  readonly archived: boolean;
  readonly projects: {
    readonly github: readonly { binding: string; owner: string; number: number }[];
    readonly t3code: readonly {
      binding?: string;
      environment: string;
      project: string;
      via: "binding" | "association";
    }[];
  };
  readonly activeTasks: number;
  readonly allocations: readonly PortfolioAllocation[];
  readonly unallocated?: readonly PortfolioUnallocated[];
}
export interface PortfolioPricing {
  readonly bundledCommit: string;
  readonly bundledModels: number;
  readonly overrides: number;
  readonly unpriced: readonly {
    readonly provider: "claude" | "codex" | "cursor" | "grok" | "opencode";
    readonly model: string | null;
    readonly postings: number;
  }[];
}
export interface PortfolioResponse {
  readonly pricing: PortfolioPricing;
  readonly commit: string | null;
  readonly at: string;
  readonly accounts: readonly PortfolioAccount[];
  readonly items: readonly PortfolioItem[];
  readonly unallocated: readonly PortfolioUnallocated[];
  readonly warnings: readonly PortfolioWarning[];
}
const positive = (v: unknown) => natural(v) && Number(v) > 0;
const percent = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;
const name = (v: unknown) => string(v) && /^[a-z][a-z0-9-]{0,63}$/.test(v);
const unallocated = (v: unknown) => shape(v, { account: name, percent, amount: natural });
const window = (v: unknown) =>
  shape(v, {
    key: string,
    opensAt: dateTime,
    closesAt: dateTime,
    capacity: natural,
    used: natural,
  });
const allocation = (v: unknown) =>
  shape(
    v,
    {
      account: name,
      declared: boolean,
      guarantee: percent,
      amount: natural,
      actual: natural,
      outstanding: natural,
      available: integer,
      reservable: natural,
      lifetime: natural,
    },
    { ceiling: percent, weight: positive, pacing: (v) => shape(v, { burst: percent }) },
  );
export function isPortfolioResponse(v: unknown): v is PortfolioResponse {
  return shape(v, {
    commit: (v) => v === null || (string(v) && /^([0-9a-f]{40}|[0-9a-f]{64})$/.test(v)),
    at: dateTime,
    accounts: array((v) =>
      shape(
        v,
        { name, declared: boolean },
        {
          archived: boolean,
          lastUsedAt: dateTime,
          unit: oneOf("usd"),
          kind: oneOf("api", "subscription"),
          capacity: (v) =>
            shape(v, {
              amount: positive,
              reset: string,
              every: (v) =>
                shape(v, { hours: positive }) ||
                shape(v, { days: positive }) ||
                shape(v, { months: positive }),
            }),
          window,
        },
      ),
    ),
    items: (v) =>
      array((v) =>
        shape(
          v,
          {
            id: nonempty,
            parent: (v) => v === null || string(v),
            title: nonempty,
            other: boolean,
            archived: boolean,
            activeTasks: natural,
            allocations: array(allocation),
            projects: (v) =>
              shape(v, {
                github: array((v) =>
                  shape(v, { binding: string, owner: string, number: positive }),
                ),
                t3code: array((v) =>
                  shape(
                    v,
                    { environment: string, project: string, via: oneOf("binding", "association") },
                    { binding: string },
                  ),
                ),
              }),
          },
          { unallocated: array(unallocated) },
        ),
      )(v) && (v as unknown[]).length > 0,
    unallocated: array(unallocated),
    pricing: (v) =>
      shape(v, {
        bundledCommit: (v) => string(v) && /^[0-9a-f]{40}$/.test(v),
        bundledModels: natural,
        overrides: natural,
        unpriced: array((v) =>
          shape(v, {
            provider: oneOf("claude", "codex", "cursor", "grok", "opencode"),
            model: (v) => v === null || nonempty(v),
            postings: positive,
          }),
        ),
      }),
    warnings: array((v) =>
      shape(
        v,
        {
          file: oneOf("portfolio"),
          kind: nonempty,
          location: string,
          severity: oneOf("warning"),
          message: string,
        },
        { details: (v) => typeof v === "object" && v !== null && !Array.isArray(v) },
      ),
    ),
  });
}
