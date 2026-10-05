// ---
// relationships:
//   verifies: escalations
// ---
import { createServer } from "node:http";
import type { RequestListener, IncomingMessage } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openStore } from "../store/index.ts";
import { openEscalations } from "./index.ts";
import type { EscalationsOptions } from "./index.ts";
export async function serve(listener: RequestListener) {
  const server = createServer(listener);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
export async function readRequest(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks).toString("utf8");
}
export async function eventually(check: () => void) {
  for (let attempt = 0; attempt < 200; attempt++) {
    try {
      check();
      return;
    } catch (error) {
      if (attempt === 199) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}
export function fixture(options: Partial<Omit<EscalationsOptions, "store">> = {}) {
  const directory = mkdtempSync(join(tmpdir(), "questions-"));
  const path = join(directory, "store.sqlite");
  const store = openStore({ path });
  const warnings: string[] = [];
  const releases: string[] = [];
  const module = openEscalations({
    store,
    configuration: { destinations: {}, requestTimeoutMs: 30000, retryIntervalMs: 60000 },
    tokenFile: () => "",
    handlers: {
      "intake-failed": () => {},
      "comparator-failed": () => {},
      "held-actor": () => {},
      "stranded-token": () => {},
    },
    logger: {
      warn: (message) => warnings.push(message),
      error: (message) => warnings.push(message),
    },
    ...options,
  });
  return {
    module,
    store,
    directory,
    path,
    warnings,
    releases,
    async close() {
      await module.stop();
      store.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
export const request = {
  kind: "held-actor" as const,
  subject: { actorId: "parcel" },
  question: "Try the delivery again?",
  choices: [
    { id: "retry", label: "Retry" },
    { id: "dismiss", label: "Dismiss" },
  ],
};
