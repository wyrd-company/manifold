// ---
// relationships:
//   implements: escalation-contract
// ---
import {
  array,
  boolean,
  integer,
  natural,
  nonempty,
  oneOf,
  record,
  shape,
  string,
} from "./api-guards.ts";
export const escalationsApiPath = "/api/escalations";
export type EscalationAnswer = { readonly choice: string } | { readonly text: string };
export interface Escalation {
  readonly id: string;
  readonly raiser:
    | {
        readonly type: "blueprint";
        readonly actorId: string;
        readonly invokeId: string;
        readonly entryId: string;
      }
    | {
        readonly type: "service";
        readonly kind: "held-actor" | "stranded-token" | "intake-failed" | "comparator-failed";
        readonly subject: Readonly<Record<string, string>>;
        readonly occurrence: number;
      };
  readonly title: string;
  readonly question: string;
  readonly choices: readonly { readonly id: string; readonly label: string }[];
  readonly freeText: boolean;
  readonly destinations: readonly string[];
  readonly status: "open" | "answered" | "withdrawn";
  readonly answer?: {
    readonly value: EscalationAnswer;
    readonly channel: "link" | "api";
    readonly at: number;
  };
  readonly raisedAt: number;
  readonly closedAt?: number;
}
export interface EscalationAnswerResponse {
  readonly outcome: "answered" | "closed";
  readonly escalation: Escalation;
}
const answer = (v: unknown) =>
  shape(v, { choice: nonempty }) ||
  shape(v, { text: (v) => nonempty(v) && Array.from(String(v)).length <= 4096 });
export function isEscalation(v: unknown): v is Escalation {
  return shape(
    v,
    {
      id: (v) => string(v) && /^[A-Za-z0-9_-]{22}$/.test(v),
      raiser: (v) =>
        shape(v, {
          type: oneOf("blueprint"),
          actorId: string,
          invokeId: string,
          entryId: string,
        }) ||
        shape(v, {
          type: oneOf("service"),
          kind: oneOf("held-actor", "stranded-token", "intake-failed", "comparator-failed"),
          subject: (v) => record(v) && Object.values(v).every(string),
          occurrence: (v) => natural(v) && Number(v) > 0,
        }),
      title: string,
      question: string,
      choices: (v) =>
        array((c) =>
          shape(c, {
            id: (v) => string(v) && v.length <= 32 && /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(v),
            label: (v) => nonempty(v) && Array.from(String(v)).length <= 40,
          }),
        )(v) && (v as unknown[]).length <= 3,
      freeText: boolean,
      destinations: array(string),
      status: oneOf("open", "answered", "withdrawn"),
      raisedAt: integer,
    },
    {
      answer: (v) => shape(v, { value: answer, channel: oneOf("link", "api"), at: integer }),
      closedAt: integer,
    },
  );
}
export function isEscalationAnswerResponse(v: unknown): v is EscalationAnswerResponse {
  return shape(v, { outcome: oneOf("answered", "closed"), escalation: isEscalation });
}
