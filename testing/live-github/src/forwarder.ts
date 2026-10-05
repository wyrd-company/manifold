// ---
// relationships:
//   implements: live-github-environment
// ---
import { createServer, request, type IncomingHttpHeaders } from "node:http";
import { once } from "node:events";

function withoutHopHeaders(headers: IncomingHttpHeaders) {
  const removed = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    ...(headers.connection?.split(",").map((value) => value.trim().toLowerCase()) ?? []),
  ]);
  return Object.fromEntries(Object.entries(headers).filter(([key]) => !removed.has(key)));
}
export async function createForwarder(options: {
  answers: boolean;
  target: () => string | undefined;
  log: (line: string) => void;
}) {
  const server = createServer((incoming, response) => {
    const target = incoming.url ?? "";
    const path = target.split("?")[0]!;
    const method = incoming.method ?? "";
    const webhook = method === "POST" && path === "/webhooks/github";
    const page =
      options.answers && method === "GET" && /^\/escalations\/[A-Za-z0-9_-]{22}$/.test(path);
    const answer =
      options.answers &&
      method === "POST" &&
      /^\/escalations\/[A-Za-z0-9_-]{22}\/answer$/.test(path);
    if (!webhook && !page && !answer) {
      options.log(`${method} ${path} refused`);
      response.writeHead(404, { "x-live-forwarder": "refused" });
      response.end();
      return;
    }
    const destination = options.target();
    if (!destination) {
      options.log(`${method} ${path} unavailable`);
      response.writeHead(503);
      response.end();
      return;
    }
    options.log(`${method} ${path} passed`);
    const origin = new URL(destination);
    const outgoing = request(
      {
        hostname: origin.hostname,
        port: origin.port,
        method,
        path: page ? target : path,
        headers: withoutHopHeaders(incoming.headers),
      },
      (upstream) => {
        response.writeHead(upstream.statusCode ?? 502, withoutHopHeaders(upstream.headers));
        upstream.pipe(response);
      },
    );
    outgoing.on("error", () => {
      if (!response.headersSent) response.writeHead(503);
      response.end();
    });
    incoming.on("aborted", () => outgoing.destroy());
    response.on("close", () => outgoing.destroy());
    incoming.pipe(outgoing);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw Error("Forwarder address unavailable");
  return {
    address: `http://127.0.0.1:${address.port}`,
    port: address.port,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
