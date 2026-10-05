// ---
// relationships:
//   implements: operator-console
// ---
import { lazy, Suspense } from "react";
const TaskFieldsEditor = lazy(() =>
  import("./task-fields/TaskFieldsEditor.tsx").then((module) => ({
    default: module.TaskFieldsEditor,
  })),
);
export function TaskFieldsContent() {
  return (
    <Suspense fallback={<p role="status">Loading task fields…</p>}>
      <TaskFieldsEditor />
    </Suspense>
  );
}
