// ---
// relationships:
//   implements: operator-console
// ---
import { useEffect, useRef, useState } from "react";
import type { PortfolioItem } from "@wyrd-company/manifold-shared/portfolio-api";
export function ProjectNames({ projects }: { projects: PortfolioItem["projects"] }) {
  const container = useRef<HTMLElement>(null),
    measure = useRef<HTMLSpanElement>(null),
    [fits, setFits] = useState(true);
  const names = [
    ...projects.github.map((p) => `${p.binding} · ${p.owner}/${p.number}`),
    ...projects.t3code.map((p) => p.binding ?? p.project),
  ].join(", ");
  const counts = [
    projects.github.length
      ? `${projects.github.length} GitHub ${projects.github.length === 1 ? "Project" : "Projects"}`
      : "",
    projects.t3code.length
      ? `${projects.t3code.length} T3code ${projects.t3code.length === 1 ? "project" : "projects"}`
      : "",
  ]
    .filter(Boolean)
    .join(", ");
  useEffect(() => {
    const element = container.current;
    if (!element || !names) return;
    const observer = new ResizeObserver(() =>
      setFits((measure.current?.getBoundingClientRect().width ?? 0) <= element.clientWidth),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [names]);
  if (!names) return null;
  return (
    <small ref={container} title={names} className="portfolio-projects muted">
      <span ref={measure} className="portfolio-project-measure" aria-hidden="true">
        {names}
      </span>
      <span className="portfolio-project-display">{fits ? names : counts}</span>
    </small>
  );
}
