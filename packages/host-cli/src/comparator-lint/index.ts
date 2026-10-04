// ---
// relationships:
//   implements: host-cli-comparator-lint
//   references: comparator-contract
// ---
import ts from "typescript";

export interface ComparatorLintLibrary {
  readonly contract: string;
  readonly libFiles: ReadonlyMap<string, string>;
}
export interface ComparatorLintDiagnostic {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly code: string;
  readonly message: string;
}
export interface ComparatorLinter {
  lint(source: {
    readonly name: string;
    readonly text: string;
  }): readonly ComparatorLintDiagnostic[];
}
const comparatorPath = "/manifold/comparator.ts";
const contractPath = "/manifold/contract/comparator.d.ts";
const checkPath = "/manifold/check.ts";
const check =
  'import type { Comparator } from "manifold:comparator"; import comparator from "./comparator.ts"; export const checked: Comparator = comparator;';
const options: ts.CompilerOptions = {
  strict: true,
  noEmit: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ["lib.es2022.d.ts"],
  types: [],
  verbatimModuleSyntax: true,
  allowImportingTsExtensions: true,
  paths: { "manifold:comparator": [contractPath] },
};

export function createComparatorLinter(library: ComparatorLintLibrary): ComparatorLinter {
  const parse = (name: string, text: string) =>
    ts.createSourceFile(name, text, options.target!, true);
  const files = new Map(
    [...library.libFiles].map(([name, text]) => [
      `/manifold/lib/${name}`,
      parse(`/manifold/lib/${name}`, text),
    ]),
  );
  files.set(contractPath, parse(contractPath, library.contract));
  files.set(checkPath, parse(checkPath, check));
  return {
    lint(source) {
      const tree = parse(comparatorPath, source.text);
      const current = new Map(files).set(comparatorPath, tree);
      const host: ts.CompilerHost = {
        getSourceFile: (name) => current.get(name),
        getDefaultLibFileName: () => "/manifold/lib/lib.es2022.d.ts",
        writeFile: () => {},
        getCurrentDirectory: () => "/manifold",
        getDirectories: () => [],
        fileExists: (name) => current.has(name),
        readFile: (name) => current.get(name)?.text,
        getCanonicalFileName: (name) => name,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => "\n",
        resolveModuleNames: (names, containingFile) =>
          names.map((name) => {
            if (name === "manifold:comparator")
              return { resolvedFileName: contractPath, extension: ts.Extension.Dts };
            if (name === "./comparator.ts" && containingFile === checkPath)
              return { resolvedFileName: comparatorPath, extension: ts.Extension.Ts };
            return undefined;
          }),
      };
      const program = ts.createProgram([comparatorPath, contractPath, checkPath], options, host);
      const diagnostics: ComparatorLintDiagnostic[] = [];
      function add(code: string, message: string, position = 0) {
        const location = tree.getLineAndCharacterOfPosition(position);
        diagnostics.push({
          file: source.name,
          line: location.line + 1,
          column: location.character + 1,
          code,
          message,
        });
      }
      for (const diagnostic of [
        ...program.getSyntacticDiagnostics(),
        ...program.getSemanticDiagnostics(),
      ]) {
        add(
          `TS${diagnostic.code}`,
          ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
          diagnostic.file?.fileName === comparatorPath ? (diagnostic.start ?? 0) : 0,
        );
      }
      const checker = program.getTypeChecker();
      const librarySymbol = (symbol: ts.Symbol | undefined, name: string) =>
        symbol?.name === name &&
        symbol.declarations?.some((declaration) =>
          declaration.getSourceFile().fileName.startsWith("/manifold/lib/"),
        );
      function visit(node: ts.Node) {
        if (ts.isIdentifier(node) && librarySymbol(checker.getSymbolAtLocation(node), "Date"))
          add(
            "comparator/no-clock",
            "Date is unavailable; use age in the input",
            node.getStart(tree),
          );
        if (
          (ts.isPropertyAccessExpression(node) &&
            librarySymbol(checker.getSymbolAtLocation(node.name), "random")) ||
          (ts.isElementAccessExpression(node) &&
            ts.isStringLiteral(node.argumentExpression) &&
            node.argumentExpression.text === "random" &&
            librarySymbol(
              checker.getTypeAtLocation(node.expression).getProperty("random"),
              "random",
            ))
        )
          add(
            "comparator/no-math-random",
            "Math.random is unavailable; use input.random",
            node.getStart(tree),
          );
        ts.forEachChild(node, visit);
      }
      visit(tree);
      return diagnostics.sort((a, b) => a.line - b.line || a.column - b.column);
    },
  };
}
