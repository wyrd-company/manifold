// ---
// relationships:
//   implements: service-assembly
// ---
import { createServer } from "node:http";
import type { HttpHost, HttpHostOptions, HttpListener } from "./types.ts";
import { matchMount, validatePrefix } from "./routes.ts";
import type { Mount } from "./routes.ts";
export function createHttpHost(options: HttpHostOptions): HttpHost {
  const mounts: Mount[] = [];
  let bound: { host: string; port: number } | undefined;
  let closing: Promise<void> | undefined;
  const server = createServer((request, response) => {
    const path = (request.url ?? "/").split("?")[0]!;
    const mount = matchMount(path, mounts);
    const answer = (status: number) => {
      response.writeHead(status).end();
    };
    if (!mount || (mount.operator && !options.configuration.operatorCredential)) {
      answer(404);
      return;
    }
    void (async () => {
      if (mount.operator) {
        const name = options.configuration.operatorCredential!;
        const credential = options.credentials.resolve(name);
        if (credential.kind !== "operator-token")
          throw new TypeError(`Credential ${name}: requires operator-token`);
        const header = request.headers.authorization;
        const presented = header?.match(/^Bearer ([^\s]+)$/)?.[1];
        if (!presented || !(await credential.verify(presented))) {
          response.setHeader("WWW-Authenticate", "Bearer");
          answer(401);
          return;
        }
      }
      mount.listener(request, response);
    })().catch((error: unknown) => {
      options.onError(error instanceof Error ? error : new Error(String(error)), {
        method: request.method ?? "",
        path,
      });
      if (!response.headersSent) answer(500);
      else response.destroy();
    });
  });
  function mount(prefix: string, listener: HttpListener, operator: boolean) {
    validatePrefix(prefix, mounts);
    mounts.push({ prefix, listener, operator });
    mounts.sort((a, b) => b.prefix.length - a.prefix.length);
  }
  return {
    mount: (prefix, listener) => mount(prefix, listener, false),
    mountOperator: (prefix, listener) => mount(prefix, listener, true),
    listen() {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(options.configuration.port, options.configuration.host, () => {
          server.removeListener("error", reject);
          const address = server.address();
          if (!address || typeof address === "string") {
            reject(new TypeError("Missing HTTP address"));
            return;
          }
          bound = { host: address.address, port: address.port };
          resolve(bound);
        });
      });
    },
    address() {
      if (!bound) throw new TypeError("HTTP host is not listening");
      return bound;
    },
    close() {
      closing ??= new Promise<void>((resolve, reject) => {
        if (!server.listening) {
          resolve();
          return;
        }
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeIdleConnections();
      });
      return closing;
    },
  };
}
