// ---
// relationships:
//   implements: portfolio
// ---
import type { PortfolioDeclaration, PortfolioFinding } from "@wyrd-company/manifold-shared";
import type { Ledger } from "../ledger/index.ts";
export interface PortfolioRevision {
  readonly commit: string;
  read(path: string): Promise<string | undefined>;
}
export type PortfolioApplyResult =
  | { status: "applied"; commit: string }
  | { status: "unchanged"; commit: string }
  | { status: "rejected"; commit: string; findings: readonly PortfolioFinding[] };
export type PortfolioInForce = { commit: string | null; declaration: PortfolioDeclaration };
export type GitHubProjectResolution = {
  binding: string;
  item: string;
  environment: string;
  t3codeProjects: readonly string[];
  archived: boolean;
};
export type T3codeProjectResolution =
  | { item: string; via: "binding" | "association"; binding: string; archived: boolean }
  | { item: "other"; via: "unbound" };
export interface Portfolio {
  readonly ledger: Ledger;
  apply(revision: PortfolioRevision): Promise<PortfolioApplyResult>;
  current(): PortfolioInForce;
  githubProject(project: { owner: string; number: number }): GitHubProjectResolution | undefined;
  t3codeProject(project: { environment: string; id: string }): T3codeProjectResolution;
}
