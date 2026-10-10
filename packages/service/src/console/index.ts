// ---
// relationships:
//   implements: [operator-console, actors-api]
// ---
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { HttpHost } from "../http-host/index.ts";
import { actorsApiPath } from "@wyrd-company/manifold-shared/actors-api";
import type { History } from "../history/index.ts";
import type { Store } from "../store/index.ts";
import { actorsListener } from "./actors-api.ts";
import { staticListener } from "./static-files.ts";
export type { HttpListener as RequestListener } from "../http-host/index.ts";
export interface ConsoleOptions {
  readonly store: Pick<Store, "activeSnapshots" | "endedSnapshots">;
  readonly history: Pick<History, "read">;
  readonly root?: string;
  readonly log?: (entry: { level: "error"; path: string; error: string }) => void;
}
export function mountConsole(host: HttpHost, options: ConsoleOptions): void {
  const root =
    options.root ??
    dirname(fileURLToPath(import.meta.resolve("@wyrd-company/manifold-console/dist/index.html")));
  if (!existsSync(join(root, "index.html")))
    throw new Error(`Console build missing: ${join(root, "index.html")}`);
  host.mount("/console", staticListener(root));
  host.mount(actorsApiPath, actorsListener(options));
}
