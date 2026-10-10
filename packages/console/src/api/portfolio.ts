// ---
// relationships:
//   implements: portfolio-api
// ---
import { isPortfolioResponse, portfolioApiPath } from "@wyrd-company/manifold-shared/portfolio-api";
import type { PortfolioResponse } from "@wyrd-company/manifold-shared/portfolio-api";
export type PortfolioResult =
  | { kind: "ok"; body: PortfolioResponse }
  | { kind: "failed"; message: string };
export function mapPortfolioResult(status: number, body: unknown): PortfolioResult {
  if (status === 200 && isPortfolioResponse(body)) return { kind: "ok", body };
  return {
    kind: "failed",
    message:
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof body.message === "string"
        ? body.message
        : "Cannot read portfolio. Check the connection and try again.",
  };
}
export async function fetchPortfolio(): Promise<PortfolioResult> {
  try {
    const response = await fetch(portfolioApiPath);
    return mapPortfolioResult(response.status, await response.json());
  } catch {
    return mapPortfolioResult(0, undefined);
  }
}
