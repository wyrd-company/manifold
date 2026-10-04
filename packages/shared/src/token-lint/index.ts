// ---
// relationships:
//   implements: token-lint
// ---
import type { BlueprintDocument } from "../blueprint-lint.ts";
import { configurationKey } from "./configuration-key.ts";
import { lintMachine } from "./lint-machine.ts";
import { explore } from "./explore.ts";
import { verdict } from "./verdict.ts";
import { defaultConfigurationBound, ExplorationBound } from "./types.ts";
import type { Graph, TokenLintOptions, TokenLintResult } from "./types.ts";
export { defaultConfigurationBound } from "./types.ts";
export type {
  TokenLintOptions,
  TokenLintResult,
  TokenVerdict,
  GateTokenLint,
  TokenChoice,
  TokenStep,
} from "./types.ts";
export function lintTokens(
  document: BlueprintDocument,
  options: TokenLintOptions,
): TokenLintResult {
  const bound = options.configurationBound ?? defaultConfigurationBound;
  if (!Number.isInteger(bound) || bound < 1)
    throw new TypeError("configurationBound must be a positive integer");
  const lint = lintMachine(document, options, bound);
  const graph: Graph = { nodes: new Map(), initial: [] };
  let incomplete = false;
  if (lint.gates.length)
    try {
      explore(lint, bound, graph);
    } catch (error) {
      if (
        !(error instanceof ExplorationBound) &&
        !(error instanceof Error && error.message.startsWith("Infinite loop detected:"))
      )
        throw error;
      incomplete = true;
    }
  return {
    gates: lint.gates.map((gate) =>
      incomplete
        ? {
            statePath: gate.statePath,
            location: gate.location,
            verdict: "unknown",
            findings: [
              {
                path: "",
                kind: "token-unknown",
                location: gate.location,
                gate: gate.statePath,
                configurationBound: bound,
                configurations: graph.nodes.size,
                message: `unknown: exploration reached bound ${bound} at ${graph.nodes.size} configurations`,
              },
            ],
          }
        : verdict(graph, gate),
    ),
    configurations: graph.nodes.size,
    configurationKey: (snapshot) => configurationKey(lint.machine, snapshot),
  };
}
