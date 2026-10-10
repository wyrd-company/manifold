// ---
// relationships:
//   implements: operator-console
// ---
import type { ApiFinding } from "@wyrd-company/manifold-shared/blueprints-api";
import { createContext } from "react";
import type { ModelDraft } from "./model-drafts.ts";
export const ModelDraftContext = createContext<
  | {
      base: string;
      models: Readonly<Record<string, ModelDraft>>;
      readOnly: boolean;
      paths: readonly string[];
      problems?: readonly ApiFinding[];
      intake?: string;
      open(path: string, source: ModelDraft): void;
      apply(path: string, source: ModelDraft): void;
    }
  | undefined
>(undefined);
