// ---
// relationships:
//   implements: service-configuration
// ---
import { createHash, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { inspect } from "node:util";
import { createAppAuth } from "@octokit/auth-app";
import { request } from "@octokit/request";
import { Lru } from "toad-cache";
import { UnknownCredentialError } from "./types.ts";
import type {
  Credentials,
  CredentialSettings,
  Credential,
  GitHubAppCredential,
  GitHubAppSettings,
  InstallationTokenRequest,
  OperatorTokenCredential,
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
function operatorToken(name: string, tokenFile: string): OperatorTokenCredential {
  return Object.freeze({
    kind: "operator-token",
    name,
    async verify(presented: string) {
      let token: string;
      try {
        token = (await readFile(tokenFile, "utf8")).trim();
        if (!token) throw new Error("Empty token file");
      } catch {
        throw new Error(`Credential ${name}: unreadable operator token`);
      }
      const digest = (value: string) => createHash("sha256").update(value).digest();
      return timingSafeEqual(digest(presented), digest(token));
    },
  });
}
export function createCredentials(
  settings: Readonly<Record<string, CredentialSettings>>,
): Credentials {
  const credentials = new Map<string, Credential>(
    Object.entries(settings).map(([name, value]) => [
      name,
      value.kind === "github-app"
        ? githubApp(name, value)
        : value.kind === "operator-token"
          ? operatorToken(name, value.tokenFile)
          : Object.freeze({ kind: "t3code-token" as const, name, tokenFile: value.tokenFile }),
    ]),
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
