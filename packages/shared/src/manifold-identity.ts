// ---
// relationships:
//   implements: blueprint
// ---
export interface ManifoldIdentity {
  readonly project?: string;
  readonly issue?: string;
  readonly environment?: string;
  readonly threads?: readonly string[];
  readonly portfolioItem?: string;
  readonly blueprintPath?: string;
}
