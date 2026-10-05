// ---
// relationships:
//   implements: operator-console
// ---
import { createRootRoute, createRoute, createRouter, Link, redirect } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { SearchX } from "lucide-react";
import { AppShell } from "./shell/AppShell.tsx";
import { navigation } from "./shell/navigation.ts";
import { PageTitle, EmptyState } from "./screens/EmptyContent.tsx";
import { OverviewContent } from "./screens/OverviewContent.tsx";
import { TaskContent } from "./screens/board/TaskContent.tsx";
import { boardSearch } from "./screens/BoardContent.tsx";
import { BoardContent } from "./screens/BoardContent.tsx";
import { EpicsContent } from "./screens/EpicsContent.tsx";
import { ActorsContent } from "./screens/ActorsContent.tsx";
import { PortfolioContent } from "./screens/PortfolioContent.tsx";
import { BlueprintsContent } from "./screens/BlueprintsContent.tsx";
import { ProjectsContent } from "./screens/ProjectsContent.tsx";
import { EnvironmentsContent } from "./screens/EnvironmentsContent.tsx";
import { SettingsContent, GeneralContent } from "./screens/SettingsContent.tsx";
import { TaskFieldsContent } from "./screens/TaskFieldsContent.tsx";
import { AccountsContent } from "./screens/AccountsContent.tsx";
const root = createRootRoute({
  component: AppShell,
  notFoundComponent: () => (
    <EmptyState
      icon={SearchX}
      title="Page not found"
      description="Choose a screen from the sidebar."
    >
      <Link to="/">Overview</Link>
    </EmptyState>
  ),
});
const contents: readonly ComponentType[] = [
  OverviewContent,
  BoardContent,
  EpicsContent,
  ActorsContent,
  PortfolioContent,
  BlueprintsContent,
  ProjectsContent,
  EnvironmentsContent,
  SettingsContent,
];
const routes = navigation.map((item, index) => {
  const Content = contents[index]!;
  return createRoute({
    getParentRoute: () => root,
    path: item.path,
    ...(item.path === "/board" ? { validateSearch: boardSearch } : {}),
    component: () => (
      <>
        <PageTitle title={item.label} description={item.description} />
        <Content />
      </>
    ),
  });
});
const blueprintEditorRoute = createRoute({
  getParentRoute: () => root,
  path: "/blueprints/$",
  component: () => (
    <>
      <PageTitle title="Blueprints" description="Blueprints / editor" />
      <BlueprintsContent />
    </>
  ),
});
const settings = routes[8]!;
settings.addChildren([
  createRoute({
    getParentRoute: () => settings,
    path: "/",
    beforeLoad: () => {
      throw redirect({ to: "/settings/task-fields" });
    },
  }),
  createRoute({
    getParentRoute: () => settings,
    path: "task-fields",
    component: () => (
      <>
        <h2>Task fields</h2>
        <TaskFieldsContent />
      </>
    ),
  }),
  createRoute({
    getParentRoute: () => settings,
    path: "accounts",
    component: () => (
      <>
        <h2>Accounts</h2>
        <AccountsContent />
      </>
    ),
  }),
  createRoute({ getParentRoute: () => settings, path: "general", component: GeneralContent }),
]);
export const router = createRouter({
  routeTree: root.addChildren([
    ...routes,
    blueprintEditorRoute,
    createRoute({
      getParentRoute: () => root,
      path: "/board/task/$actorId",
      validateSearch: boardSearch,
      component: TaskContent,
    }),
  ]),
  basepath: "/console",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
