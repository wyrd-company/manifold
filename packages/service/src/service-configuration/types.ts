// ---
// relationships:
//   implements: service-configuration
// ---
import type { EnvironmentsConfiguration } from "../t3code-source/types.ts";
import type { GitHubConfiguration } from "../github-source/types.ts";
import type { ExpressionsConfiguration } from "../blueprint-expressions.ts";
import type { ComparatorSandboxLimits } from "../comparator-sandbox/index.ts";
import type { SecretValue } from "./credentials.ts";
export interface ServiceConfiguration {
  readonly http: HttpHostConfiguration;
  readonly store: StoreConfiguration;
  readonly blueprintLint: { readonly configurationBound: number };
  readonly escalations: EscalationsConfiguration;
  readonly agentTools: AgentToolsConfiguration;
  readonly environments: EnvironmentsConfiguration;
  readonly github: GitHubConfiguration;
  readonly file: string;
  readonly processRepository: ProcessRepositoryConfiguration;
  readonly comparatorSandbox: ComparatorSandboxLimits;
  readonly expressions: ExpressionsConfiguration;
  readonly credentials: Credentials;
}
export interface ProcessRepositoryConfiguration {
  readonly url: string;
  readonly branch: string;
  readonly credential: string | undefined;
  readonly directory: string;
  readonly pullTimeoutMs: number;
  readonly commitAuthor: { readonly name: string; readonly email: string };
}
export interface Credentials {
  readonly names: readonly string[];
  resolve(name: string): Credential;
}
export type Credential = GitHubAppCredential | T3CodeTokenCredential | NtfyTokenCredential;
export interface T3CodeTokenCredential {
  readonly kind: "t3code-token";
  readonly name: string;
  readonly tokenFile: string;
}
export type CredentialSettings =
  | GitHubAppSettings
  | { kind: "t3code-token" | "ntfy-token"; tokenFile: string };
export interface GitHubAppCredential {
  readonly kind: "github-app";
  readonly name: string;
  installationToken(request: InstallationTokenRequest): Promise<SecretValue>;
}
export interface InstallationTokenRequest {
  readonly repositories?: readonly string[];
  readonly permissions?: Readonly<Record<string, "read" | "write">>;
  readonly signal?: AbortSignal;
}
export interface ConfigurationIssue {
  readonly path: string;
  readonly message: string;
}
export class ServiceConfigurationError extends Error {
  readonly file: string;
  readonly issues: readonly ConfigurationIssue[];
  constructor(file: string, issues: readonly ConfigurationIssue[]) {
    super(`${file}\n${issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n")}`);
    this.name = "ServiceConfigurationError";
    this.file = file;
    this.issues = issues;
  }
}
export class UnknownCredentialError extends Error {
  readonly credential: string;
  constructor(credential: string) {
    super(`Unknown credential: ${credential}`);
    this.name = "UnknownCredentialError";
    this.credential = credential;
  }
}
export interface GitHubAppSettings {
  kind: "github-app";
  appId: number;
  installationId: number;
  privateKeyFile: string;
  apiUrl: string;
}

export interface HttpHostConfiguration {
  readonly host: string;
  readonly port: number;
}
export interface StoreConfiguration {
  readonly file: string;
}
export interface NtfyTokenCredential {
  readonly kind: "ntfy-token";
  readonly name: string;
  readonly tokenFile: string;
}
export interface EscalationsConfiguration {
  readonly publicUrl?: string;
  readonly destinations: Readonly<
    Record<
      string,
      {
        readonly server: string;
        readonly topic: string;
        readonly posture: "open" | "reserved" | "self-hosted";
        readonly credential?: string;
        readonly priority: number;
      }
    >
  >;
  readonly requestTimeoutMs: number;
  readonly retryIntervalMs: number;
}

export interface AgentToolsConfiguration {
  readonly identifyTimeoutMs: number;
}
