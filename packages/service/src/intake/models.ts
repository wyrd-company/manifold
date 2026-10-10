// ---
// relationships:
//   implements: intake
// ---
import { lintProcessManifest } from "@wyrd-company/manifold-shared";
import type {
  ProcessRepositoryRevision,
  ProcessManifestFinding,
} from "@wyrd-company/manifold-shared";
import { createDecisionModels } from "../decision-models.ts";
import type { DecisionModels } from "../decision-models.ts";
type Models =
  | { ok: true; key: string; models: DecisionModels }
  | { ok: false; findings: readonly ProcessManifestFinding[] };
// The serial runner holds models through the whole attempt. Once it releases
// them, only models for the published commit remain cached.
export function modelCache(
  create = (models: Readonly<Record<string, unknown>>) => createDecisionModels(models),
) {
  let cached: { commit: string; value: Models } | undefined;
  return {
    async get(revision: ProcessRepositoryRevision): Promise<Models> {
      if (cached?.commit === revision.commit) return cached.value;
      const lint = await lintProcessManifest(revision.read);
      const value: Models = lint.ok
        ? { ok: true, key: lint.manifest.intake.decisionModel, models: create(lint.models) }
        : { ok: false, findings: lint.findings };
      if (cached?.value.ok) cached.value.models.dispose();
      cached = { commit: revision.commit, value };
      return value;
    },
    retain(commit: string | undefined) {
      if (cached && cached.commit !== commit) {
        if (cached.value.ok) cached.value.models.dispose();
        cached = undefined;
      }
    },
    dispose() {
      if (cached?.value.ok) cached.value.models.dispose();
      cached = undefined;
    },
  };
}
