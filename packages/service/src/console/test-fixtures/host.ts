// ---
// relationships:
//   verifies: [operator-console, actors-api]
// ---
import { createHttpHost } from "../../http-host/index.ts";

export async function consoleHost(token: string | undefined) {
  const host = createHttpHost({
    configuration: {
      host: "127.0.0.1",
      port: 0,
      operatorCredential: token ? "sample-operator" : undefined,
    },
    credentials: {
      names: token ? ["sample-operator"] : [],
      resolve: (name) => ({
        kind: "operator-token",
        name,
        verify: async (presented) => presented === token,
      }),
    },
    onError: (error) => {
      throw error;
    },
  });
  const address = await host.listen();
  return { host, url: `http://${address.host}:${address.port}`, close: () => host.close() };
}
