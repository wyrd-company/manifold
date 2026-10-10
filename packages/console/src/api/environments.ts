// ---
// relationships:
//   implements: [environments-api, operator-console]
// ---
import {
  environmentsApiPath,
  isEnvironmentsResponse,
  isEnvironmentSummary,
  isEnvironmentErrorResponse,
} from "@wyrd-company/manifold-shared/environments-api";
import type {
  EnvironmentAction,
  EnvironmentSummary,
  EnvironmentsResponse,
} from "@wyrd-company/manifold-shared/environments-api";
type Result<T> = { kind: "ok"; body: T } | { kind: "failed"; message: string };
export function mapEnvironmentResult(
  operation: "list",
  status: number,
  body: unknown,
): Result<EnvironmentsResponse>;
export function mapEnvironmentResult(
  operation: "action",
  status: number,
  body: unknown,
): Result<EnvironmentSummary>;
export function mapEnvironmentResult(
  operation: "list" | "action",
  status: number,
  body: unknown,
): Result<EnvironmentsResponse | EnvironmentSummary> {
  if (status === 200) {
    if (operation === "list" && isEnvironmentsResponse(body)) return { kind: "ok", body };
    if (operation === "action" && isEnvironmentSummary(body)) return { kind: "ok", body };
  }
  return {
    kind: "failed",
    message: isEnvironmentErrorResponse(body)
      ? body.error.message
      : "The service returned an invalid environments response.",
  };
}
export async function fetchEnvironments(): Promise<Result<EnvironmentsResponse>> {
  try {
    const response = await fetch(environmentsApiPath);
    return mapEnvironmentResult("list", response.status, await response.json());
  } catch {
    return { kind: "failed", message: "Could not read environments from the service." };
  }
}
export async function actOnEnvironment(
  name: string,
  action: EnvironmentAction,
): Promise<Result<EnvironmentSummary>> {
  try {
    const response = await fetch(`${environmentsApiPath}/${encodeURIComponent(name)}/${action}`, {
      method: "POST",
    });
    return mapEnvironmentResult("action", response.status, await response.json());
  } catch {
    return { kind: "failed", message: "Could not reach the service." };
  }
}
