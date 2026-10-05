// ---
// relationships:
//   implements: live-github-environment
// ---
import { resolve } from "node:path";
import { stringify } from "yaml";
import { writeIfChanged } from "./settings.ts";
import type { Settings } from "./settings.ts";
type Options = { url?: string; answers?: boolean; overlay?: Record<string, unknown> };
export function serviceConfiguration(
  settings: Settings,
  directory: string,
  resources: { hook: { id: number } },
  app: { appId: number; installationId: number },
  options: Options = {},
) {
  const overlay = options.overlay ?? {};
  const overlayCredentials = record(overlay["credentials"]);
  const config: Record<string, unknown> = {
    ...overlay,
    processRepository: {
      url: `https://github.com/${settings.organization}/${settings.processRepository}.git`,
      credential: "live-app",
      directory: resolve(directory, "service/clone"),
    },
    store: { file: resolve(directory, "service/manifold.sqlite") },
    http: { host: "127.0.0.1", port: 0 },
    credentials: {
      ...overlayCredentials,
      "live-app": {
        kind: "github-app",
        ...app,
        privateKeyFile: settings.credentials.appPrivateKeyFile,
      },
    },
    github: {
      owners: {
        [settings.organization]: {
          credential: "live-app",
          hooks: [{ id: resources.hook.id, secretFile: resolve(directory, "hook.secret") }],
        },
      },
      sweepIntervalMs: settings.sweepIntervalMs,
    },
  };
  if (options.answers && options.url)
    config["escalations"] = { ...record(overlay["escalations"]), publicUrl: options.url };
  return config;
}
function record(value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Overlay section must be a mapping");
  return value as Record<string, unknown>;
}
export async function writeConfiguration(...args: Parameters<typeof serviceConfiguration>) {
  return writeIfChanged(resolve(args[1], "service.yml"), stringify(serviceConfiguration(...args)));
}
