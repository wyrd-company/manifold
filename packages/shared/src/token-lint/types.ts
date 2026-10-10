// ---
// relationships:
//   implements: token-lint
// ---
import type { AnyMachineSnapshot, Snapshot } from "xstate";
import type { BlueprintFinding } from "../blueprint-lint.ts";
import type { ImplementationNames } from "../implementation-names.ts";
export const defaultConfigurationBound = 20000;
export interface TokenLintOptions {
  readonly names: ImplementationNames;
  readonly configurationBound?: number;
}
export type TokenVerdict = "proved" | "violation" | "potential" | "unknown";
export type TokenStep = {
  readonly event: string;
  readonly configuration: string;
  readonly grant?: boolean;
};
export type TokenChoice = {
  readonly step: number;
  readonly location: string;
  readonly raises?: string;
  readonly value: boolean;
};
export interface GateTokenLint {
  readonly statePath: string;
  readonly location: string;
  readonly verdict: TokenVerdict;
  readonly findings: readonly BlueprintFinding[];
  readonly traps?: ReadonlySet<string>;
}
export interface TokenLintResult {
  readonly gates: readonly GateTokenLint[];
  readonly configurations: number;
  configurationKey(snapshot: Snapshot<unknown>): string;
}
export interface Gate {
  statePath: string;
  location: string;
  token: string;
  returnState?: string;
}
export interface Choice {
  location: string;
  raises?: string;
  value: boolean;
}
export interface Edge {
  event: string;
  target: string;
  choices: readonly Choice[];
  markers: readonly (readonly string[])[];
  activeGates: readonly (readonly string[])[];
}
export interface Node {
  snapshot: AnyMachineSnapshot;
  edges: Edge[];
}
export interface Graph {
  nodes: Map<string, Node>;
  initial: Edge[];
}
export class ExplorationBound extends Error {}
export const marker = (kind: "return" | "exit", path: string) => `token-lint:${kind}:${path}`;
