// ---
// relationships:
//   implements: host-command-catalog
// ---
import type { RunnablePath } from "./catalog/command-tree.generated.ts";
import type { CommandHandler } from "./catalog/types.ts";

export const commandHandlers = {
  "blueprint lint": async (args) => {
    const { blueprintLintCommand } = await import("./blueprint-lint/command.ts");
    const { bundledFiles } = await import("@wyrd-company/manifold-shared");
    return blueprintLintCommand(args, { files: new Map(Object.entries(bundledFiles)) });
  },
  "comparator lint": async (args) => {
    const { comparatorLintCommand } = await import("./comparator-lint/command.ts");
    return comparatorLintCommand(args);
  },
  "expressions lint": async (args) => {
    const { expressionsLintCommand } = await import("./expressions-lint/command.ts");
    return expressionsLintCommand(args);
  },
  "manifest lint": async (args) => {
    const { manifestLintCommand } = await import("./manifest-lint/command.ts");
    return manifestLintCommand(args);
  },
  "portfolio lint": async (args) => {
    const { portfolioLintCommand } = await import("./portfolio-lint/command.ts");
    return portfolioLintCommand(args);
  },
  "task-metadata lint": async (args) => {
    const { taskMetadataLintCommand } = await import("./task-metadata-lint/command.ts");
    return taskMetadataLintCommand(args);
  },
  mcp: async (args) => {
    const { mcpCommand } = await import("./mcp/command.ts");
    return mcpCommand(args);
  },
  "usage decode": async (args, io) => {
    const { runUsageCommand } = await import("./usage/index.ts");
    return runUsageCommand(["decode", ...args], io);
  },
  "usage lint": async (args, io) => {
    const { usageLintCommand } = await import("./usage-lint/command.ts");
    return usageLintCommand(args, io);
  },
  "usage push": async (args, io) => {
    const { runUsagePush } = await import("./usage-push/index.ts");
    return runUsagePush(args, io);
  },
} satisfies Record<Exclude<RunnablePath, "help">, CommandHandler>;
