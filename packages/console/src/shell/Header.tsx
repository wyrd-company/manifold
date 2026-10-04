// ---
// relationships:
//   implements: operator-console
// ---
import { PanelLeft, Workflow, ChevronRight } from "lucide-react";
import { useLocation } from "@tanstack/react-router";
import { Button } from "../ui/button.tsx";
import { navigation, settingsTabs } from "./navigation.ts";
import { ThemeToggle } from "./ThemeToggle.tsx";
import { CommandSearch } from "./CommandSearch.tsx";
export function Header({ toggleSidebar }: { toggleSidebar: () => void }) {
  const path = useLocation({
    select: (location) => location.pathname.replace(/^\/console/, "") || "/",
  });
  const current = navigation.find(
    (item) => item.path === path || (item.path !== "/" && path.startsWith(item.path + "/")),
  );
  const tab = settingsTabs.find((item) => item.path === path);
  return (
    <header>
      <Button variant="ghost" size="icon" aria-label="Toggle sidebar" onClick={toggleSidebar}>
        <PanelLeft />
      </Button>
      <div className="brand">
        <Workflow size={19} />
        <span>Manifold</span>
      </div>
      <div className="breadcrumb">
        <ChevronRight size={14} />
        <span>{current?.label ?? "Page not found"}</span>
        {tab ? (
          <>
            <ChevronRight size={14} />
            <span>{tab.label}</span>
          </>
        ) : null}
      </div>
      <div className="header-space" />
      <CommandSearch />
      <ThemeToggle />
    </header>
  );
}
