// ---
// relationships:
//   implements: operator-console
// ---
import { navigation } from "../shell/navigation.ts";
import { EmptyState } from "./EmptyContent.tsx";
export function OverviewContent() {
  return <EmptyState icon={navigation.find((item) => item.label === "Overview")!.icon} />;
}
