// ---
// relationships:
//   implements: [operator-console, actors-api]
// ---
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import { actorsApiPath } from "@wyrd-company/manifold-shared/actors-api";
import type { Store } from "../store/index.ts";
import { actorsListener } from "./actors-api.ts";
import { staticListener } from "./static-files.ts";
export type RequestListener = (request: IncomingMessage, response: ServerResponse) => void;
export interface ConsoleHttpHost {
  mount(pathPrefix: string, listener: RequestListener): void;
  mountOperator(pathPrefix: string, listener: RequestListener): void;
}
export interface ConsoleOptions {
  readonly store: Pick<Store, "activeSnapshots">;
  readonly root?: string;
  readonly log?: (entry: { level: "error"; path: string; error: string }) => void;
}
export function mountConsole(host: ConsoleHttpHost, options: ConsoleOptions): void {
  const root =
    options.root ??
    dirname(fileURLToPath(import.meta.resolve("@wyrd-company/manifold-console/dist/index.html")));
  if (!existsSync(join(root, "index.html")))
    throw new Error(`Console build missing: ${join(root, "index.html")}`);
  host.mount("/console", staticListener(root));
  host.mountOperator(actorsApiPath, actorsListener(options));
}
