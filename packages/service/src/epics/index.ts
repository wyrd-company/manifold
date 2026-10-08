// ---
// relationships:
//   implements: epics-api
// ---
import { epicRoots, epicOf } from "./epics.ts";
import type { Epics, EpicsOptions } from "./types.ts";
export type { Epics, EpicsOptions, EpicsGitHub } from "./types.ts";
export function openEpics(options: EpicsOptions): Epics {
  const epics: Epics = {
    roots: () => epicRoots(options.github.trackedIssues()),
    get(id) {
      const tracked = options.github.trackedIssues();
      return epicOf(id, tracked, options.tasks.list(tracked));
    },
    requestListener(request, response) {
      const path = new URL(request.url ?? "/", "http://localhost").pathname;
      if (request.method !== "GET") {
        response.writeHead(405, { Allow: "GET" }).end();
        return;
      }
      try {
        const match = /^\/api\/epics\/([^/]+)$/.exec(path);
        const body =
          path === "/api/epics"
            ? epics.roots()
            : match
              ? epics.get(decodeURIComponent(match[1]!))
              : undefined;
        if (!body) {
          response.writeHead(404).end();
          return;
        }
        response
          .writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" })
          .end(JSON.stringify(body));
      } catch (error) {
        options.log?.({
          level: "error",
          path,
          error: error instanceof Error ? error.message : String(error),
        });
        response.writeHead(500).end();
      }
    },
  };
  return epics;
}
