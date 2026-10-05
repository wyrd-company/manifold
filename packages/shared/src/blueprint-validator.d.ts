// ---
// relationships:
//   realizes: blueprint
// ---
import type { BlueprintDocument } from "./blueprint-lint.ts";
export default function validateBlueprint(value: unknown): value is BlueprintDocument;
