// ---
// relationships:
//   implements: blueprints-api
// ---
import type { Store } from "../store/index.ts";
import type { ProcessRepository } from "../process-repository/index.ts";
import type { Revisions } from "../service/index.ts";
export interface BlueprintBundle {
  readonly digest: string;
  readonly blueprints: ReadonlyMap<string, string>;
}
export interface BlueprintsApiOptions {
  readonly revisions: Pick<Revisions, "latest" | "save">;
  readonly processRepository: Pick<ProcessRepository, "revisionAt">;
  readonly store: Pick<Store, "activeSnapshots">;
  readonly repository: { readonly url: string; readonly branch: string };
  readonly configurationBound: number;
  readonly bundle: BlueprintBundle;
  readonly log: (entry: { level: "error"; path: string; error: string }) => void;
}
