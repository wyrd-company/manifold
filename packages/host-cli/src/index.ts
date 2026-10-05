// ---
// relationships:
//   implements:
//     - host-cli-manifest-lint
//     - host-cli-blueprint-lint
//     - host-cli-portfolio-lint
// ---
export { manifestLintCommand } from "./manifest-lint/command.ts";
export { blueprintLintCommand } from "./blueprint-lint/command.ts";
export { portfolioLintCommand } from "./portfolio-lint/command.ts";

export function banner(): string {
  return "manifold-host: placeholder";
}
