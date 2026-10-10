// ---
// relationships:
//   implements: declarations-api
// ---
import { findingRanges, lintPortfolioDeclaration } from "@wyrd-company/manifold-shared";
import { parseDocument } from "yaml";
import type { PortfolioDeclaration } from "@wyrd-company/manifold-shared";
type BindingsDocument = {
  githubProjects?: Record<
    string,
    Omit<PortfolioDeclaration["githubProjects"][number], "name" | "archived" | "t3codeProjects"> & {
      archived?: boolean;
      t3codeProjects?: readonly string[];
    }
  >;
  t3codeProjects?: Record<
    string,
    Omit<PortfolioDeclaration["t3codeProjects"][number], "name" | "archived"> & {
      archived?: boolean;
    }
  >;
};
import type { ProcessRepositoryRevision } from "@wyrd-company/manifold-shared";
import type {
  DeclarationPath,
  DeclarationFindings,
  BindingsResponse,
  DeclarationFinding,
} from "@wyrd-company/manifold-shared/declarations-api";
import { sharingPreview } from "./sharing-preview.ts";
import { organizationScope } from "./organization-scope.ts";
import { repositoryFieldScope } from "./repository-scope.ts";
import { taskFieldRows } from "./task-fields.ts";
import type { DeclarationsApiOptions } from "./types.ts";
import {
  lintTaskMetadataDeclaration as lintTaskMetadata,
  taskFieldStorageKinds,
  lintAllocatedAccounts,
  lintUsageDeclaration,
} from "@wyrd-company/manifold-shared";
export async function lintAnswer(
  options: DeclarationsApiOptions,
  revision: ProcessRepositoryRevision,
  path: DeclarationPath,
  text: string,
): Promise<DeclarationFindings> {
  const bindings = await revision.read("bindings.yml");
  if (path === "accounts.yml") {
    const lint = lintUsageDeclaration({
      accounts: text,
      prices: await revision.read("prices.yml"),
    });
    return {
      findings: (lint.ok ? [] : lint.findings).map((finding) =>
        finding.file === "accounts" ? findingRanges(text, [finding])[0]! : finding,
      ),
      warnings: lintAllocatedAccounts({
        portfolio: await revision.read("portfolio.yml"),
        accounts: text,
      }),
    };
  }
  if (path === "task-metadata.yml") {
    const lint = lintTaskMetadata({ taskMetadata: text, bindings });
    const fields = taskFieldRows(text);
    const plans = lint.ok ? options.planDeclaration(lint.declaration) : [];
    const bound = lint.ok ? await bindingsAnswer(options, revision) : undefined;
    const impact = bound
      ? bound.githubProjects
          .filter((binding) => !binding.archived)
          .map((binding) => {
            const plan = plans.find((plan) => plan.binding === binding.name);
            return {
              binding: binding.name,
              ...(plan
                ? {
                    creates: plan.changes.filter((change) => change.action === "create").length,
                    changes: plan.changes.filter((change) => change.action === "change").length,
                    removes: plan.changes.filter((change) => change.action === "remove").length,
                  }
                : {}),
            };
          })
      : undefined;
    return {
      findings: findingRanges(text, lint.ok ? [] : lint.findings),
      warnings: [],
      ...(fields
        ? {
            fields: fields.map((row) => {
              const status = plans
                .find((plan) => plan.binding === row.binding)
                ?.fields.find((field) =>
                  row.lifecycle
                    ? field.lifecycle && !field.taskField
                    : field.taskField === row.name,
                );
              return {
                ...row,
                ...organizationScope(row, lint.ok ? lint.declaration : undefined),
                ...(lint.ok && repositoryFieldScope(row, lint.declaration, plans)
                  ? { scope: repositoryFieldScope(row, lint.declaration, plans)! }
                  : {}),
                ...(status ? { onGitHub: { state: status.github, detail: status.detail } } : {}),
              };
            }),
            storageKinds: taskFieldStorageKinds,
          }
        : {}),
      ...(impact ? { impact } : {}),
    };
  }
  const lint = lintPortfolioDeclaration({
    portfolio: path === "portfolio.yml" ? text : await revision.read("portfolio.yml"),
    bindings: path === "bindings.yml" ? text : bindings,
  });
  const findings = lint.ok
    ? []
    : lint.findings.filter((finding) => path === "portfolio.yml" || finding.file === "bindings");
  const located: DeclarationFinding[] = findings.map((finding) => {
    const { file, ...rest } = finding;
    const own = file === (path === "portfolio.yml" ? "portfolio" : "bindings");
    const ranged = own ? findingRanges(text, [rest])[0]! : rest;
    return { ...ranged, ...(path === "portfolio.yml" ? { file } : {}) };
  });
  const warnings =
    path === "portfolio.yml"
      ? findingRanges(
          text,
          lintAllocatedAccounts({ portfolio: text, accounts: await revision.read("accounts.yml") }),
        )
      : [];
  const accounts =
    path === "portfolio.yml" && lint.ok
      ? lintUsageDeclaration({ prices: undefined, accounts: await revision.read("accounts.yml") })
      : undefined;
  return {
    findings: located,
    warnings,
    ...(lint.ok && accounts?.ok
      ? { preview: sharingPreview(lint.ledgerPortfolio, accounts.declaration.accounts) }
      : {}),
  };
}
export async function bindingsAnswer(
  options: DeclarationsApiOptions,
  revision: ProcessRepositoryRevision,
): Promise<BindingsResponse> {
  const portfolio = await revision.read("portfolio.yml"),
    bindings = await revision.read("bindings.yml");
  const bindingLint = await lintAnswer(options, revision, "bindings.yml", bindings ?? "");
  const ownPortfolio = lintPortfolioDeclaration({ portfolio, bindings: undefined });
  const declared = bindingLint.findings.length
    ? {}
    : ((parseDocument(bindings ?? "").toJS() ?? {}) as BindingsDocument);
  return {
    createdProjects: options
      .createdProjects()
      .filter((p) => !p.retirable && p.resolution.via === "created")
      .map((p) => ({
        environment: p.environment,
        project: p.project,
        actorId: p.actorId,
        item: p.createdItem,
      })),
    repository: options.repository,
    commit: revision.commit,
    findings: bindingLint.findings,
    githubProjects: Object.entries(declared.githubProjects ?? {}).map(([name, binding]) => ({
      ...binding,
      name,
      archived: binding.archived ?? false,
      t3codeProjects: binding.t3codeProjects ?? [],
    })),
    t3codeProjects: Object.entries(declared.t3codeProjects ?? {}).map(([name, binding]) => ({
      ...binding,
      name,
      archived: binding.archived ?? false,
    })),
    items: ownPortfolio.ok
      ? ownPortfolio.declaration.items
          .filter((item) => !item.other && !item.archived)
          .map((item) => ({ id: item.id, ...(item.title ? { title: item.title } : {}) }))
      : [],
    environments: options.environments.map((name) => {
      const projects = options.t3codeProjects(name);
      return {
        name,
        ...(projects
          ? {
              projects: [...projects].sort(
                (a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
              ),
            }
          : {}),
      };
    }),
  };
}
