// ---
// relationships:
//   implements: operator-console
// ---
import { Link } from "@tanstack/react-router";
import { navigation } from "./navigation.ts";
import { SidebarFrame } from "../ui/sidebar.tsx";
export function Sidebar({ collapsed }: { collapsed: boolean }) {
  return (
    <SidebarFrame collapsed={collapsed}>
      <nav aria-label="Main">
        {["", "Plan", "Configure", "Settings"].map((group) => (
          <div className={`nav-group ${group === "Settings" ? "nav-bottom" : ""}`} key={group}>
            {group && group !== "Settings" ? (
              <div className="group-label">{collapsed ? <hr /> : group}</div>
            ) : null}
            {navigation
              .filter((item) => item.group === group)
              .map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-label={item.label}
                  title={collapsed ? item.label : undefined}
                  activeOptions={{
                    exact:
                      item.path !== "/settings" &&
                      item.path !== "/board" &&
                      item.path !== "/actors" &&
                      item.path !== "/epics",
                  }}
                  activeProps={{ className: "active", "aria-current": "page" }}
                >
                  <item.icon aria-hidden="true" />
                  {collapsed ? null : <span>{item.label}</span>}
                </Link>
              ))}
          </div>
        ))}
      </nav>
    </SidebarFrame>
  );
}
