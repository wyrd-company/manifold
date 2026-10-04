// ---
// relationships:
//   verifies: [operator-console, actors-api]
// ---
import { createHttpHost } from "../../http-host/index.ts";

export async function consoleHost() {
  const host = createHttpHost({
    configuration: {
      host: "127.0.0.1",
      port: 0,
      operatorCredential: undefined,
    },
    credentials: {
      names: [],
      resolve: (name) => {
        throw new Error(`Unexpected credential: ${name}`);
      },
    },
    onError: (error) => {
      throw error;
    },
  });
  const address = await host.listen();
  return { host, url: `http://${address.host}:${address.port}`, close: () => host.close() };
}
