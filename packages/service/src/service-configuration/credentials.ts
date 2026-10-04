// ---
// relationships:
//   implements: service-configuration
// ---
import { readFile } from "node:fs/promises";
import { inspect } from "node:util";
import { createAppAuth } from "@octokit/auth-app";
import { request } from "@octokit/request";
import { Lru } from "toad-cache";
import { UnknownCredentialError } from "./types.ts";
import type {
  Credentials,
  GitHubAppCredential,
  GitHubAppSettings,
  InstallationTokenRequest,
} from "./types.ts";

export class SecretValue {
  readonly credential: string;
  #value: string;
  constructor(credential: string, value: string) {
    this.credential = credential;
    this.#value = value;
    Object.freeze(this);
  }
  reveal(): string {
    return this.#value;
  }
  toString(): string {
    return `[credential ${this.credential}]`;
  }
  toJSON(): string {
    return this.toString();
  }
  [inspect.custom](): string {
    return this.toString();
  }
}
function githubApp(name: string, settings: GitHubAppSettings): GitHubAppCredential {
  // Match the cache policy shipped by @octokit/auth-app.
  const cache = new Lru<string>(15000, 59 * 60 * 1000);
  return Object.freeze({
    kind: "github-app",
    name,
    async installationToken(options: InstallationTokenRequest) {
      try {
        options.signal?.throwIfAborted();
        const auth = createAppAuth({
          appId: settings.appId,
          installationId: settings.installationId,
          privateKey: await readFile(settings.privateKeyFile, "utf8"),
          cache: {
            get: async (key: string) => cache.get(key)!,
            set: async (key: string, value: string) => {
              cache.set(key, value);
            },
          },
          request: request.defaults({
            baseUrl: settings.apiUrl,
            request: options.signal ? { signal: options.signal } : {},
          }),
        });
        const result = await auth({
          type: "installation",
          ...(options.repositories ? { repositoryNames: [...options.repositories] } : {}),
          ...(options.permissions ? { permissions: options.permissions } : {}),
        });
        options.signal?.throwIfAborted();
        return new SecretValue(name, result.token);
      } catch (error) {
        if (options.signal?.aborted) throw options.signal.reason;
        const status =
          error && typeof error === "object" && "status" in error
            ? String(error.status)
            : "unavailable";
        // eslint-disable-next-line preserve-caught-error -- Upstream errors can contain credentials.
        throw new Error(`Credential ${name}: GitHub status ${status}`);
      }
    },
  });
}
export function createCredentials(
  settings: Readonly<Record<string, GitHubAppSettings>>,
): Credentials {
  const credentials = new Map(
    Object.entries(settings).map(([name, value]) => [name, githubApp(name, value)]),
  );
  return Object.freeze({
    names: Object.freeze([...credentials.keys()].sort()),
    resolve(name: string) {
      const value = credentials.get(name);
      if (!value) throw new UnknownCredentialError(name);
      return value;
    },
  });
}
