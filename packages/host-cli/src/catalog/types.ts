// ---
// relationships:
//   implements: host-command-catalog
// ---
import type { Writable } from "node:stream";

export type Argument = {
  readonly name: string;
  readonly description: string;
  readonly position: number;
  readonly required: boolean;
  readonly greedy?: boolean;
};
export type Flag = {
  readonly flags: readonly string[];
  readonly kind: "flag" | "option";
  readonly description: string;
  readonly required: boolean;
  readonly repeatable?: boolean;
  readonly default?: string | number | boolean;
  readonly value?: { readonly type: string };
};
export type CommandNode = {
  readonly name: string;
  readonly summary: string;
  readonly arguments: readonly Argument[];
  readonly flags: readonly Flag[];
  readonly exitCodes: readonly { readonly code: number; readonly meaning: string }[];
  readonly examples: readonly string[];
  readonly subcommands?: readonly CommandNode[];
};
export type CommandTree = {
  readonly tool: { readonly name: string; readonly summary: string };
  readonly help: { readonly flags: readonly string[]; readonly description: string };
  readonly commands: readonly CommandNode[];
};
export type HelpNode = CommandNode & {
  readonly tool: string;
  readonly path: readonly string[];
  readonly help: CommandTree["help"];
};
export type CommandIO = {
  stdout: Writable;
  stderr: Writable;
  env: Readonly<Record<string, string | undefined>>;
  home: string;
};
export type CommandHandler = (args: string[], io: CommandIO) => Promise<number>;
export type HostCommand = {
  readonly path: readonly string[];
  readonly summary: string;
  readonly arguments: readonly Argument[];
  readonly flags: readonly Flag[];
  readonly handler: CommandHandler;
};
export type HostCommandCatalog = readonly HostCommand[];
