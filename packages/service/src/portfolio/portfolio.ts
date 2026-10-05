// ---
// relationships:
//   implements: portfolio
//   references: [portfolio-declarations-table, portfolio-ledger]
// ---
import {
  lintAllocatedAccounts,
  lintPortfolioDeclaration,
  parseLedgerPortfolio,
} from "@wyrd-company/manifold-shared";
import type {
  PortfolioDeclaration,
  ProcessRepositoryRevision,
} from "@wyrd-company/manifold-shared";
import { createLedger } from "../ledger/index.ts";
import type { LedgerConnection } from "../ledger/index.ts";
import { resolvePortfolio } from "./resolution.ts";
import type { Portfolio, PortfolioApplyResult, PortfolioInForce } from "./types.ts";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
const emptyDeclaration: PortfolioDeclaration = {
  ledger: { items: [{ id: "other", parent: null, archived: false }], allocations: [] },
  items: [{ id: "other", parent: null, title: "Other", archived: false, other: true }],
  githubProjects: [],
  t3codeProjects: [],
};

export function openPortfolio(options: {
  connection: LedgerConnection;
  now?: () => number;
}): Portfolio {
  const { connection } = options;
  const now = options.now ?? Date.now;
  const latest = connection.database.prepare(
    "SELECT commit_id, declaration FROM portfolio_declarations ORDER BY seq DESC LIMIT 1",
  );
  const insert = connection.database.prepare(
    "INSERT INTO portfolio_declarations (commit_id, declaration, accepted_at) VALUES (?, ?, ?)",
  );
  const row = latest.get() as { commit_id: string; declaration: string } | undefined;
  let current: PortfolioInForce = {
    commit: row?.commit_id ?? null,
    declaration:
      row === undefined ? emptyDeclaration : (JSON.parse(row.declaration) as PortfolioDeclaration),
  };
  let serialized = canonical(current.declaration);
  let resolution = resolvePortfolio(current.declaration);
  const ledger = createLedger({
    connection,
    portfolio: parseLedgerPortfolio(current.declaration.ledger),
    now,
  });
  let pending: Promise<unknown> = Promise.resolve();

  async function apply(revision: ProcessRepositoryRevision): Promise<PortfolioApplyResult> {
    const [portfolio, bindings, accounts] = await Promise.all([
      revision.read("portfolio.yml"),
      revision.read("bindings.yml"),
      revision.read("accounts.yml"),
    ]);
    const warnings = lintAllocatedAccounts({ portfolio, accounts });
    const result = lintPortfolioDeclaration({ portfolio, bindings });
    if (!result.ok)
      return { status: "rejected", commit: revision.commit, findings: result.findings, warnings };
    const next = canonical(result.declaration);
    if (next === serialized) return { status: "unchanged", commit: revision.commit, warnings };
    const nextResolution = resolvePortfolio(result.declaration);
    connection.transaction(() => insert.run(revision.commit, next, now()));
    ledger.setPortfolio(result.ledgerPortfolio);
    resolution = nextResolution;
    current = { commit: revision.commit, declaration: result.declaration };
    serialized = next;
    return { status: "applied", commit: revision.commit, warnings };
  }
  return {
    ledger,
    apply(revision) {
      const operation = pending.then(() => apply(revision));
      pending = operation.catch(() => undefined);
      return operation;
    },
    current: () => current,
    githubProject: (project) => resolution.githubProject(project),
    t3codeProject: (project) => resolution.t3codeProject(project),
  };
}
