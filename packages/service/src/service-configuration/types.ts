// ---
// relationships:
//   implements: service-configuration
// ---
import type { ExpressionsConfiguration } from "../blueprint-expressions.ts";
import type { ComparatorSandboxLimits } from "../comparator-sandbox/index.ts";
import type { SecretValue } from "./credentials.ts";
export interface ServiceConfiguration {
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
}
export interface Credentials {
  readonly names: readonly string[];
  resolve(name: string): Credential;
}
export type Credential = GitHubAppCredential;
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
