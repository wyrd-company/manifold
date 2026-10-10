// ---
// relationships:
//   implements: comparator-sandbox
//   references: comparator-contract
// ---
import ts from "typescript";
import type { ComparatorSource } from "./index.ts";

export function transpileComparator(source: ComparatorSource) {
  const result = ts.transpileModule(source.text, {
    fileName: source.name,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  const diagnostic = result.diagnostics?.[0];
  if (diagnostic) {
    const position = diagnostic.file?.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    return {
      ok: false as const,
      failure: {
        kind: "transpile" as const,
        message: `${source.name}:${(position?.line ?? 0) + 1}:${(position?.character ?? 0) + 1} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
      },
    };
  }
  const tree = ts.createSourceFile(
    source.name,
    source.text,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );
  let reference: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (reference) return;
    const typeImport =
      ts.isImportDeclaration(node) &&
      node.importClause &&
      (node.importClause.isTypeOnly ||
        (!node.importClause.name &&
          node.importClause.namedBindings &&
          ts.isNamedImports(node.importClause.namedBindings) &&
          node.importClause.namedBindings.elements.length > 0 &&
          node.importClause.namedBindings.elements.every((binding) => binding.isTypeOnly)));
    if (
      (ts.isImportDeclaration(node) && !typeImport) ||
      ts.isImportEqualsDeclaration(node) ||
      (ts.isExportDeclaration(node) && node.moduleSpecifier) ||
      (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) ||
      (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword)
    )
      reference = node;
    else ts.forEachChild(node, visit);
  }
  visit(tree);
  if (reference) {
    const position = tree.getLineAndCharacterOfPosition(reference.getStart(tree));
    return {
      ok: false as const,
      failure: {
        kind: "module" as const,
        message: `${source.name}:${position.line + 1}:${position.character + 1} Module references are unavailable`,
      },
    };
  }
  return { ok: true as const, code: result.outputText };
}
