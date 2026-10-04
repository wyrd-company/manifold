// ---
// relationships:
//   implements: operator-console
// ---
import { navigation } from "../shell/navigation.ts";
import { EmptyState } from "./EmptyContent.tsx";
export function EpicsContent() {
  return <EmptyState icon={navigation.find((item) => item.label === "Epics")!.icon} />;
}
