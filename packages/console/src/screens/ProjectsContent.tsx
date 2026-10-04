// ---
// relationships:
//   implements: operator-console
// ---
import { navigation } from "../shell/navigation.ts";
import { EmptyState } from "./EmptyContent.tsx";
export function ProjectsContent() {
  return <EmptyState icon={navigation.find((item) => item.label === "GitHub Projects")!.icon} />;
}
