// ---
// relationships:
//   implements: [portfolio-declaration, bindings-declaration]
// ---
import type { LedgerPortfolio, LedgerPortfolioInput } from "./ledger-portfolio.ts";
export type PortfolioFindingKind =
  | "syntax"
  | "schema"
  | "duplicate-item"
  | "other-without-items"
  | "invalid-portfolio"
  | "guarantee-limit"
  | "duplicate-binding"
  | "duplicate-project"
  | "duplicate-association"
  | "bound-and-associated"
  | "unknown-item"
  | "archived-item";
export type PortfolioFinding = {
  file: "portfolio" | "bindings";
  location: string;
  kind: PortfolioFindingKind;
  message: string;
  details?: Readonly<Record<string, unknown>>;
};
export type PortfolioDeclaration = {
  ledger: LedgerPortfolioInput;
  items: readonly {
    id: string;
    parent: string | null;
    title: string;
    archived: boolean;
    other: boolean;
  }[];
  githubProjects: readonly {
    name: string;
    owner: string;
    number: number;
    environment: string;
    item: string;
    t3codeProjects: readonly string[];
    archived: boolean;
  }[];
  t3codeProjects: readonly {
    name: string;
    environment: string;
    project: string;
    item: string;
    archived: boolean;
  }[];
};
export type PortfolioLintResult =
  | { ok: true; declaration: PortfolioDeclaration; ledgerPortfolio: LedgerPortfolio }
  | { ok: false; findings: readonly PortfolioFinding[] };
// These document shapes are narrowed by the specification schemas at the YAML boundary.
export type AllocationDocument = Omit<
  LedgerPortfolioInput["allocations"][number],
  "item" | "account" | "guarantee"
> & { guarantee?: number };
export type ItemDocument = {
  title?: string;
  archived?: boolean;
  allocations?: Record<string, AllocationDocument>;
  items?: Record<string, ItemDocument>;
};
export type PortfolioDocument = { items?: Record<string, ItemDocument> };
export type BindingsDocument = {
  githubProjects?: Record<
    string,
    Omit<PortfolioDeclaration["githubProjects"][number], "name" | "archived" | "t3codeProjects"> & {
      archived?: boolean;
      t3codeProjects?: string[];
    }
  >;
  t3codeProjects?: Record<
    string,
    Omit<PortfolioDeclaration["t3codeProjects"][number], "name" | "archived"> & {
      archived?: boolean;
    }
  >;
};
