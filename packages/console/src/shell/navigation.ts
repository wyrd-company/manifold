// ---
// relationships:
//   implements: operator-console
// ---
import {
  LayoutDashboard,
  Columns3,
  GitFork,
  Activity,
  ChartPie,
  Workflow,
  TableProperties,
  Server,
  Settings,
} from "lucide-react";
export const navigation = [
  {
    path: "/",
    label: "Overview",
    icon: LayoutDashboard,
    group: "",
    description: "A view of your work across projects.",
  },
  {
    path: "/board",
    label: "Board",
    icon: Columns3,
    group: "",
    description: "Work arranged by its current state.",
  },
  {
    path: "/epics",
    label: "Epics",
    icon: GitFork,
    group: "",
    description: "The relationships between your work.",
  },
  {
    path: "/actors",
    label: "Actors",
    icon: Activity,
    group: "",
    description: "Every actor and its progress through a blueprint.",
  },
  {
    path: "/portfolio",
    label: "Portfolio",
    icon: ChartPie,
    group: "Plan",
    description: "How capacity is allocated across your work.",
  },
  {
    path: "/blueprints",
    label: "Blueprints",
    icon: Workflow,
    group: "Configure",
    description: "The processes that run your work.",
  },
  {
    path: "/projects",
    label: "GitHub Projects",
    icon: TableProperties,
    group: "Configure",
    description: "Projects bound to your portfolio.",
  },
  {
    path: "/environments",
    label: "Environments",
    icon: Server,
    group: "Configure",
    description: "The T3 Code environments that run your agents.",
  },
  {
    path: "/settings",
    label: "Settings",
    icon: Settings,
    group: "Settings",
    description: "Configure Manifold for your work.",
  },
] as const;
export const settingsTabs = [
  { path: "/settings/task-fields", label: "Task fields" },
  { path: "/settings/accounts", label: "Accounts" },
  { path: "/settings/general", label: "General" },
] as const;
