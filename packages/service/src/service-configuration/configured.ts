// ---
// relationships:
//   implements: github-source-configuration
//   references: service-configuration
// ---
import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadServiceConfiguration as load } from "./load.ts";
import { ServiceConfigurationError } from "./types.ts";
import type { ConfigurationIssue } from "./types.ts";

export async function loadServiceConfiguration(file: string) {
  const configuration = await load(file);
  const issues: ConfigurationIssue[] = [];
  const owners = new Set<string>();
  const hooks = new Set<number>();
  const resolvedOwners = await Promise.all(
    Object.entries(configuration.github.owners).map(async ([owner, settings]) => {
      const path = `/github/owners/${owner}`;
      if (owners.has(owner.toLowerCase())) issues.push({ path, message: "Repeated owner login" });
      owners.add(owner.toLowerCase());
      try {
        if (configuration.credentials.resolve(settings.credential).kind !== "github-app")
          issues.push({ path: `${path}/credential`, message: "Requires a github-app credential" });
      } catch {
        issues.push({
          path: `${path}/credential`,
          message: `Unknown credential: ${settings.credential}`,
        });
      }
      const resolvedHooks = await Promise.all(
        settings.hooks.map(async (hook, index) => {
          const hookPath = `${path}/hooks/${index}`;
          if (hooks.has(hook.id))
            issues.push({ path: `${hookPath}/id`, message: "Repeated hook id" });
          hooks.add(hook.id);
          const secretFile = resolve(dirname(configuration.file), hook.secretFile);
          try {
            await access(secretFile, constants.R_OK);
            if (!(await stat(secretFile)).isFile()) throw new Error("Not a file");
          } catch (error) {
            issues.push({
              path: `${hookPath}/secretFile`,
              message:
                error && typeof error === "object" && "code" in error
                  ? String(error.code)
                  : "unreadable",
            });
          }
          return Object.freeze({ ...hook, repository: hook.repository, secretFile });
        }),
      );
      return [owner, Object.freeze({ ...settings, hooks: Object.freeze(resolvedHooks) })] as const;
    }),
  );
  for (const [name, environment] of Object.entries(configuration.environments)) {
    const path = `/environments/${name}`;
    try {
      const url = new URL(environment.url);
      if (url.username || url.password)
        issues.push({ path: `${path}/url`, message: "URL must have no user information" });
    } catch {
      issues.push({ path: `${path}/url`, message: "Invalid URL" });
    }
    if (environment.reconnect.maxMs < environment.reconnect.initialMs)
      issues.push({ path: `${path}/reconnect/maxMs`, message: "Must be at least initialMs" });
    try {
      if (configuration.credentials.resolve(environment.credential).kind !== "t3code-token")
        issues.push({ path: `${path}/credential`, message: "Requires a t3code-token credential" });
    } catch {
      issues.push({
        path: `${path}/credential`,
        message: `Unknown credential: ${environment.credential}`,
      });
    }
  }
  if (issues.length) throw new ServiceConfigurationError(configuration.file, issues);
  return Object.freeze({
    ...configuration,
    github: Object.freeze({
      ...configuration.github,
      owners: Object.freeze(Object.fromEntries(resolvedOwners)),
    }),
  });
}
