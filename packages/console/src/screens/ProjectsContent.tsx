// ---
// relationships:
//   implements: operator-console
// ---
import { useParams } from "@tanstack/react-router";
import { ProjectsList } from "./projects/ProjectsList.tsx";
import { ProjectPage } from "./projects/ProjectPage.tsx";
export function ProjectsContent() {
  const { binding } = useParams({ strict: false });
  return binding ? <ProjectPage key={binding} binding={binding} /> : <ProjectsList />;
}
