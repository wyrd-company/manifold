// ---
// relationships:
//   verifies: [operator-console, actors-api]
// ---
import { createServer } from "node:http";
import type { RequestListener } from "../index.ts";

export async function consoleHost(token: string | undefined) {
  const routes: { prefix: string; listener: RequestListener; operator: boolean }[] = [];
  const host = {
    mount(prefix: string, listener: RequestListener) {
      routes.push({ prefix, listener, operator: false });
    },
    mountOperator(prefix: string, listener: RequestListener) {
      routes.push({ prefix, listener, operator: true });
    },
  };
  const server = createServer((request, response) => {
    const path = request.url?.split("?")[0] ?? "/";
    const route = routes.find(({ prefix }) => path === prefix || path.startsWith(`${prefix}/`));
    if (!route || (route.operator && !token)) {
      response.writeHead(404).end();
      return;
    }
    if (route.operator && request.headers.authorization !== `Bearer ${token}`) {
      response.writeHead(401).end();
      return;
    }
    route.listener(request, response);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  return {
    host,
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
