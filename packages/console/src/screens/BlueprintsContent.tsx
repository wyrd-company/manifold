// ---
// relationships:
//   implements: operator-console
// ---
import { lazy, Suspense } from "react";
import { useParams } from "@tanstack/react-router";
import { BlueprintsList } from "./blueprints/BlueprintsList.tsx";
const BlueprintEditor = lazy(() =>
  import("./blueprints/BlueprintEditor.tsx").then((module) => ({
    default: module.BlueprintEditor,
  })),
);
export function BlueprintsContent() {
  const params = useParams({ strict: false });
  return params._splat ? (
    <Suspense fallback={<p role="status">Loading blueprint…</p>}>
      <BlueprintEditor path={params._splat} />
    </Suspense>
  ) : (
    <BlueprintsList />
  );
}
