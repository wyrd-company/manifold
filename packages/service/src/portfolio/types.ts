// ---
// relationships:
//   implements: portfolio
// ---
import type {
  PortfolioDeclaration,
  PortfolioFinding,
  PortfolioWarning,
  ProcessRepositoryRevision,
} from "@wyrd-company/manifold-shared";
import type { Ledger } from "../ledger/index.ts";
export type PortfolioApplyResult = { warnings: readonly PortfolioWarning[] } & (
  | { status: "applied"; commit: string }
  | { status: "unchanged"; commit: string }
  | { status: "rejected"; commit: string; findings: readonly PortfolioFinding[] }
);
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
  | { item: string; via: "created"; actorId: string }
  | { item: "other"; via: "unbound" };
export type CreatedProjectOwnership = {
  environment: string;
  project: string;
  actorId: string;
  createdItem: string;
  resolution: T3codeProjectResolution;
  usageItem: string;
  unresolved: boolean;
  retirable: boolean;
};
export interface Portfolio {
  readonly ledger: Ledger;
  apply(revision: ProcessRepositoryRevision): Promise<PortfolioApplyResult>;
  current(): PortfolioInForce;
  usageItem(item: string): string;
  createdProjects(): readonly CreatedProjectOwnership[];
  githubProject(project: { owner: string; number: number }): GitHubProjectResolution | undefined;
  t3codeProject(project: { environment: string; id: string }): T3codeProjectResolution;
}
