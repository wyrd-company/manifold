// ---
// relationships:
//   implements: operator-console
// ---
import { Link, Outlet } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { EmptyState } from "./EmptyContent.tsx";
import { settingsTabs } from "../shell/navigation.ts";
export function SettingsContent() {
  return (
    <>
      <nav aria-label="Settings" className="tabs">
        {settingsTabs.map((tab) => (
          <Link
            key={tab.path}
            to={tab.path}
            activeProps={{ className: "active", "aria-current": "page" }}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </>
  );
}
export function GeneralContent() {
  return (
    <>
      <h2>General</h2>
      <EmptyState icon={Settings} />
    </>
  );
}
