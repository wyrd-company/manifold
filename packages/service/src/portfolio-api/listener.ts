// ---
// relationships:
//   implements: portfolio-api
// ---
import type { HttpHost } from "../http-host/index.ts";
import type { Store } from "../store/index.ts";
import type { Ledger } from "../ledger/index.ts";
import type { PortfolioInForce } from "../portfolio/index.ts";
import type { ProcessRepository } from "../process-repository/index.ts";
import type { UsageAccount } from "@wyrd-company/manifold-shared";
import type { PortfolioWarning } from "@wyrd-company/manifold-shared/portfolio-api";
import { portfolioRead } from "./read.ts";
import { lintAllocatedAccounts } from "./account-lint-stand-in.ts";
export interface PortfolioApiOptions {
  readonly portfolio: {
    current(): PortfolioInForce;
    readonly ledger: Pick<Ledger, "balance" | "windowAt" | "totals">;
  };
  accounts(): Readonly<Record<string, UsageAccount>>;
  readonly processRepository: Pick<ProcessRepository, "revisionAt">;
  readonly store: Pick<Store, "activeSnapshots">;
  readonly now?: () => number;
  readonly log: (entry: { level: "error"; path: string; error: string }) => void;
}
export function mountPortfolioApi(host: HttpHost, options: PortfolioApiOptions): void {
  let cache: { commit: string; warnings: readonly PortfolioWarning[] } | undefined;
  host.mount("/api/portfolio", (request, response) => {
    const answer = (status: number, body: unknown) => {
      response.writeHead(status, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      response.end(JSON.stringify(body));
    };
    const path = new URL(request.url ?? "/", "http://example.test").pathname;
    if (path !== "/api/portfolio") {
      answer(404, { error: "not-found", message: "Unknown portfolio endpoint." });
      return;
    }
    if (request.method !== "GET") {
      response.setHeader("Allow", "GET");
      answer(405, { error: "method-not-allowed", message: "Expected GET." });
      return;
    }
    void (async () => {
      const portfolio = options.portfolio.current(),
        accounts = options.accounts();
      let warnings: readonly PortfolioWarning[] = [];
      if (portfolio.commit) {
        if (cache?.commit !== portfolio.commit) {
          const revision = await options.processRepository.revisionAt(portfolio.commit);
          if (!revision) throw Error("Portfolio revision unavailable.");
          cache = {
            commit: portfolio.commit,
            warnings: lintAllocatedAccounts({
              portfolio: await revision.read("portfolio.yml"),
              accounts: undefined,
            }),
          };
        }
        warnings = cache.warnings.filter(
          (w) => !Object.hasOwn(accounts, String(w.details?.["account"])),
        );
      }
      const names = [
        ...new Set([
          ...Object.keys(accounts),
          ...portfolio.declaration.ledger.allocations.map((a) => a.account),
        ]),
      ];
      const at = (options.now ?? Date.now)();
      const balances = new Map(
        portfolio.declaration.items.map((item) => [
          item.id,
          new Map(
            names.map((account) => [
              account,
              options.portfolio.ledger.balance({ item: item.id, account, waiting: [] }),
            ]),
          ),
        ]),
      );
      const totals = new Map(
        names.map((account) => [account, options.portfolio.ledger.totals({ account })]),
      );
      answer(
        200,
        portfolioRead({
          portfolio,
          accounts,
          balances,
          totals,
          warnings,
          snapshots: options.store.activeSnapshots(),
          at,
        }),
      );
    })().catch((error) => {
      options.log({
        level: "error",
        path,
        error: error instanceof Error ? error.message : String(error),
      });
      if (!response.writableEnded)
        answer(500, { error: "internal", message: "Portfolio read failed." });
    });
  });
}
