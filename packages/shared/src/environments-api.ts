// ---
// relationships:
//   implements: environments-api
// ---
import { array, boolean, natural, nonempty, oneOf, shape, string, uri } from "./api-guards.ts";
export const environmentsApiPath = "/api/environments";
export type EnvironmentAction = "pause" | "resume" | "disconnect" | "reconnect";
export type EnvironmentConnection = "connected" | "connecting" | "disconnected";
export interface EnvironmentSummary {
  readonly name: string;
  readonly host: string;
  readonly url: string;
  readonly status: EnvironmentConnection | "paused";
  readonly connection: EnvironmentConnection;
  readonly paused: boolean;
  readonly disconnected: boolean;
  readonly error?: string;
  readonly activeThreads: number | null;
  readonly scheduledThreads: number;
}
export interface EnvironmentsResponse {
  readonly configurationFile: string;
  readonly environments: readonly EnvironmentSummary[];
}
export interface EnvironmentErrorResponse {
  readonly error: {
    readonly kind:
      | "unknown-environment"
      | "unknown-action"
      | "not-found"
      | "method-not-allowed"
      | "action-failed";
    readonly message: string;
  };
}
export const isEnvironmentAction = (value: unknown): value is EnvironmentAction =>
  oneOf("pause", "resume", "disconnect", "reconnect")(value);
export const isEnvironmentSummary = (value: unknown): value is EnvironmentSummary =>
  shape(
    value,
    {
      name: (value) =>
        string(value) && value.length <= 64 && /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(value),
      host: nonempty,
      url: uri,
      status: oneOf("connected", "connecting", "disconnected", "paused"),
      connection: oneOf("connected", "connecting", "disconnected"),
      paused: boolean,
      disconnected: boolean,
      activeThreads: (value) => value === null || natural(value),
      scheduledThreads: natural,
    },
    { error: nonempty },
  );
export const isEnvironmentsResponse = (value: unknown): value is EnvironmentsResponse =>
  shape(value, { configurationFile: nonempty, environments: array(isEnvironmentSummary) });
export const isEnvironmentErrorResponse = (value: unknown): value is EnvironmentErrorResponse =>
  shape(value, {
    error: (value) =>
      shape(value, {
        kind: oneOf(
          "unknown-environment",
          "unknown-action",
          "not-found",
          "method-not-allowed",
          "action-failed",
        ),
        message: string,
      }),
  });
