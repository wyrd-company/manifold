// ---
// relationships:
//   implements: operator-console
// ---
import sirv from "sirv";
import type { RequestListener } from "./index.ts";
export function staticListener(root: string): RequestListener {
  const serve = sirv(root, {
    setHeaders(response, path) {
      response.setHeader(
        "Cache-Control",
        /[/\\]assets[/\\]/.test(path) ? "public, max-age=31536000, immutable" : "no-cache",
      );
    },
  });
  return (request, response) => {
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'",
    );
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const original = request.url ?? "";
    let path: string;
    try {
      path = decodeURIComponent(original.split("?")[0] ?? "");
    } catch {
      response.writeHead(404).end();
      return;
    }
    if (path.includes("\\") || path.includes("\0") || path.split("/").includes("..")) {
      response.writeHead(404).end();
      return;
    }
    if (path === "/console") {
      response.writeHead(302, { Location: "/console/" }).end();
      return;
    }
    if (!path.startsWith("/console/")) {
      response.writeHead(404).end();
      return;
    }
    request.url = original.slice("/console".length);
    serve(request, response, () => {
      const relative = path.slice("/console/".length);
      if (
        relative.startsWith("assets/") ||
        (/\.[^/]+$/.test(relative) && !/^blueprints\/blueprints\/.+\.ya?ml$/.test(relative))
      ) {
        response.writeHead(404).end();
        return;
      }
      request.url = "/index.html";
      serve(request, response, () => {
        response.writeHead(404).end();
      });
    });
    request.url = original;
  };
}
