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
  createdProjects?: () => readonly {
    environment: string;
    projectId: string;
    actorId: string;
    item: string;
    retirable: boolean;
  }[];
  createdProject?: (project: {
    environment: string;
    id: string;
  }) => { actorId: string; item: string } | undefined;
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
  function t3codeProject(project: { environment: string; id: string }) {
    const declared = resolution.t3codeProject(project);
    if (declared.via !== "unbound") return declared;
    const created = options.createdProject?.(project);
    if (created && current.declaration.items.some((item) => item.id === created.item))
      return { item: created.item, via: "created" as const, actorId: created.actorId };
    return declared;
  }
  function usageItem(item: string) {
    return current.declaration.items.some((row) => row.id === `${item}/other`)
      ? `${item}/other`
      : item;
  }
  function archived(id: string): boolean {
    const item = current.declaration.items.find((item) => item.id === id);
    return !!item && (item.archived || (item.parent !== null && archived(item.parent)));
  }
  return {
    ledger,
    usageItem,
    createdProjects: () =>
      (options.createdProjects?.() ?? []).map((record) => {
        const resolved = t3codeProject({ environment: record.environment, id: record.projectId });
        return {
          environment: record.environment,
          project: record.projectId,
          actorId: record.actorId,
          createdItem: record.item,
          resolution: resolved,
          usageItem: usageItem(resolved.item),
          unresolved: resolved.via === "created" && archived(resolved.item),
          retirable: record.retirable,
        };
      }),
    apply(revision) {
      const operation = pending.then(() => apply(revision));
      pending = operation.catch(() => undefined);
      return operation;
    },
    current: () => current,
    githubProject: (project) => resolution.githubProject(project),
    t3codeProject,
  };
}
