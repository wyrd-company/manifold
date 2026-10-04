// ---
// relationships:
//   implements: [portfolio-declaration, bindings-declaration]
//   references: [portfolio-ledger, service-configuration]
// ---
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";
import { parse } from "yaml";
import { LedgerError, parseLedgerPortfolio } from "./ledger-portfolio.ts";
import {
  portfolioDeclarationSchema,
  bindingsDeclarationSchema,
} from "./portfolio-declaration-schema.ts";
import type {
  BindingsDocument,
  PortfolioDocument,
  PortfolioDeclaration,
  PortfolioFinding,
  PortfolioLintResult,
} from "./portfolio-declaration-types.ts";
import { pointerSegment, normalizePortfolio } from "./portfolio-normalization.ts";
import { lintBindings } from "./portfolio-bindings.ts";

// Task 1135 supplies root and section schemas. Tests register its declared-name stand-in
// here until rebase; production registration belongs here once those constants land.
export const portfolioDeclarationAjv = new Ajv2020({ allErrors: true, strict: false });
let portfolioValidator: ValidateFunction<PortfolioDocument> | undefined;
let bindingsValidator: ValidateFunction<BindingsDocument> | undefined;

function readDocument<T>(
  text: string | undefined,
  file: PortfolioFinding["file"],
  validate: ValidateFunction<T>,
  findings: PortfolioFinding[],
): T | undefined {
  let document: unknown;
  try {
    document = text === undefined ? {} : (parse(text) ?? {});
  } catch (error) {
    findings.push({
      file,
      kind: "syntax",
      location: "",
      message: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
  // JSON Schema describes JSON values; a YAML alias cycle is not one.
  try {
    JSON.stringify(document);
  } catch (error) {
    findings.push({
      file,
      kind: "schema",
      location: "",
      message: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
  if (validate(document)) return document;
  for (const error of validate.errors ?? []) {
    const property =
      error.propertyName ?? error.params["missingProperty"] ?? error.params["additionalProperty"];
    const location =
      error.instancePath + (typeof property === "string" ? `/${pointerSegment(property)}` : "");
    findings.push({
      file,
      kind: "schema",
      location,
      message: error.message ?? "Invalid document.",
    });
  }
  return undefined;
}

export function lintPortfolioDeclaration(files: {
  portfolio: string | undefined;
  bindings: string | undefined;
}): PortfolioLintResult {
  portfolioValidator ??= portfolioDeclarationAjv.compile<PortfolioDocument>(
    portfolioDeclarationSchema,
  );
  bindingsValidator ??=
    portfolioDeclarationAjv.compile<BindingsDocument>(bindingsDeclarationSchema);
  const portfolioFindings: PortfolioFinding[] = [];
  const bindingFindings: PortfolioFinding[] = [];
  const portfolio = readDocument(
    files.portfolio,
    "portfolio",
    portfolioValidator,
    portfolioFindings,
  );
  const bindings = readDocument(files.bindings, "bindings", bindingsValidator, bindingFindings);
  const normalized =
    portfolio === undefined ? undefined : normalizePortfolio(portfolio, portfolioFindings);
  const bound =
    bindings === undefined
      ? undefined
      : lintBindings(bindings, normalized?.declaration.items, bindingFindings);
  let ledgerPortfolio;
  if (normalized) {
    for (const { row, location } of normalized.rows) {
      try {
        parseLedgerPortfolio({ items: [{ id: row.item, parent: null }], allocations: [row] });
      } catch (error) {
        if (!(error instanceof LedgerError)) throw error;
        const fields = ["guarantee", "ceiling", "burst", "weight"].filter(
          (field) => field in error.details,
        );
        const field = fields.length === 1 ? fields[0] : undefined;
        portfolioFindings.push({
          file: "portfolio",
          kind: "invalid-portfolio",
          location:
            location +
            (field === undefined ? "" : field === "burst" ? "/pacing/burst" : `/${field}`),
          message: error.message,
          details: error.details,
        });
      }
    }
    if (portfolioFindings.length === 0) {
      try {
        ledgerPortfolio = parseLedgerPortfolio(normalized.declaration.ledger);
      } catch (error) {
        if (!(error instanceof LedgerError)) throw error;
        const guarantee = error.code === "guarantee-limit";
        const parent = error.details["parent"];
        portfolioFindings.push({
          file: "portfolio",
          kind: guarantee ? "guarantee-limit" : "invalid-portfolio",
          location:
            guarantee && typeof parent === "string"
              ? `${normalized.itemLocations.get(parent)}/items`
              : "/items",
          message: error.message,
          details: error.details,
        });
      }
    }
  }
  const findings = [...portfolioFindings, ...bindingFindings];
  if (findings.length > 0) return { ok: false, findings };
  const declaration: PortfolioDeclaration = { ...normalized!.declaration, ...bound! };
  return { ok: true, declaration, ledgerPortfolio: ledgerPortfolio! };
}
