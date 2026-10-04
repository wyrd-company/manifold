// ---
// relationships:
//   implements: operator-console
// ---
import { useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { Header } from "./Header.tsx";
import { Sidebar } from "./Sidebar.tsx";
export function AppShell() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("manifold.sidebar") === "rail",
  );
  return (
    <div className="app-shell">
      <Header
        toggleSidebar={() =>
          setCollapsed((value) => {
            localStorage.setItem("manifold.sidebar", value ? "expanded" : "rail");
            return !value;
          })
        }
      />
      <div className="app-body">
        <Sidebar collapsed={collapsed} />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
