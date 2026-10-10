// ---
// relationships:
//   implements: service-configuration
// ---
import { access, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parseDocument } from "yaml";
import {
  serviceConfigurationSchemaId,
  serviceConfigurationSchemas,
} from "@wyrd-company/manifold-shared";
import { createCredentials } from "./credentials.ts";
import { ServiceConfigurationError } from "./types.ts";
import type { ConfigurationIssue, CredentialSettings, ServiceConfiguration } from "./types.ts";

const credentialFileFields = {
  "github-app": ["privateKeyFile"],
  "t3code-token": ["tokenFile"],
  "ntfy-token": ["tokenFile"],
} as const;

type ConfigurationDocument = Omit<ServiceConfiguration, "file" | "credentials"> & {
  credentials: Record<string, CredentialSettings>;
};
const ajv = new Ajv2020({ allErrors: true, useDefaults: true });
for (const schema of serviceConfigurationSchemas) ajv.addSchema(schema);
const validate = ajv.getSchema<ConfigurationDocument>(serviceConfigurationSchemaId)!;
function code(error: unknown): string {
  return error && typeof error === "object" && "code" in error ? String(error.code) : "unreadable";
}
function pointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
export async function loadServiceConfiguration(file: string): Promise<ServiceConfiguration> {
  file = resolve(file);
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    throw new ServiceConfigurationError(file, [{ path: "", message: code(error) }]);
  }
  const document = parseDocument(text);
  if (document.errors.length)
    throw new ServiceConfigurationError(
      file,
      document.errors.map((error) => ({
        path: "",
        message: `Invalid YAML at line ${error.linePos?.[0].line ?? "?"}, column ${error.linePos?.[0].col ?? "?"}`,
      })),
    );
  let value: unknown;
  try {
    value = document.toJS();
  } catch {
    throw new ServiceConfigurationError(file, [{ path: "", message: "Invalid YAML document" }]);
  }
  const valid = validate(value);
  if (!valid) {
    throw new ServiceConfigurationError(
      file,
      (validate.errors ?? []).map((error) => ({
        path:
          error.instancePath +
          (error.keyword === "required"
            ? "/" + pointer(String(error.params["missingProperty"]))
            : error.keyword === "additionalProperties"
              ? "/" + pointer(String(error.params["additionalProperty"]))
              : ""),
        message: error.message ?? "Invalid value",
      })),
    );
  }
  const issues: ConfigurationIssue[] = [];
  const configuration = value as ConfigurationDocument;
  const repository = configuration.processRepository;
  if (repository.credential && !Object.hasOwn(configuration.credentials, repository.credential))
    issues.push({
      path: "/processRepository/credential",
      message: `Unknown credential: ${repository.credential}`,
    });
  try {
    const url = new URL(repository.url);
    if (url.username || url.password)
      issues.push({ path: "/processRepository/url", message: "URL must have no user information" });
    if (repository.credential && url.protocol !== "https:")
      issues.push({ path: "/processRepository/url", message: "Authentication requires HTTPS" });
  } catch {
    issues.push({ path: "/processRepository/url", message: "Invalid URL" });
  }
  for (const [name, settings] of Object.entries(configuration.credentials)) {
    for (const field of credentialFileFields[settings.kind]) {
      const files = settings as unknown as Record<string, string>;
      const path = resolve(dirname(file), files[field]!);
      files[field] = path;
      try {
        await access(path, constants.R_OK);
        if (!(await stat(path)).isFile()) throw new Error("Not a file");
      } catch (error) {
        issues.push({ path: `/credentials/${pointer(name)}/${field}`, message: code(error) });
      }
    }
  }
  if (issues.length) throw new ServiceConfigurationError(file, issues);
  return freeze({
    ...configuration,
    file,
    store: { file: resolve(dirname(file), configuration.store.file) },
    processRepository: {
      ...repository,
      credential: repository.credential,
      directory: resolve(dirname(file), repository.directory),
    },
    credentials: createCredentials(configuration.credentials),
  });
}
