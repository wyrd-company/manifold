// ---
// relationships:
//   implements: service-configuration
// ---
/* eslint-disable unicorn/no-thenable -- JSON Schema uses the then keyword. */
import { blueprintLintConfigurationSchema } from "./blueprint-lint-configuration-schema.ts";
import { t3codeEnvironmentsConfigurationSchema } from "./t3code-environments-configuration-schema.ts";
import { expressionsConfigurationSchema } from "./expressions-configuration-schema.ts";
import { githubSourceConfigurationSchema } from "./github-source-configuration-schema.ts";
import { escalationsConfigurationSchema } from "./escalations-configuration-schema.ts";
// Generated from the specification assets; agreement is tested.
export const serviceConfigurationSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://manifold.wyrd.company/schemas/service-configuration",
  title: "Service configuration",
  description:
    "The root document of the service configuration file. Each section other than `credentials` is specified by the module that owns it and composed here by `$ref` to that section's `$id`.",
  type: "object",
  additionalProperties: false,
  required: ["processRepository", "store"],
  properties: {
    processRepository: {
      $ref: "https://manifold.wyrd.company/schemas/process-repository-configuration",
    },
    store: {
      $ref: "https://manifold.wyrd.company/schemas/store-configuration",
    },
    credentials: {
      description:
        "The credentials behind each name the process repository and the service configuration use, keyed by credential name.",
      type: "object",
      default: {},
      propertyNames: {
        $ref: "#/$defs/declared-name",
      },
      additionalProperties: {
        $ref: "#/$defs/credential",
      },
    },
    comparatorSandbox: {
      $ref: "https://manifold.wyrd.company/schemas/comparator-sandbox-configuration",
      default: {},
    },
    expressions: {
      $ref: "https://manifold.wyrd.company/schemas/expressions-configuration",
      default: {},
    },
    github: {
      $ref: "https://manifold.wyrd.company/schemas/github-source-configuration",
      default: {},
    },
    environments: {
      $ref: "https://manifold.wyrd.company/schemas/t3code-environments-configuration",
      default: {},
    },
    http: {
      $ref: "https://manifold.wyrd.company/schemas/http-host-configuration",
      default: {},
    },
    blueprintLint: {
      $ref: "https://manifold.wyrd.company/schemas/blueprint-lint-configuration",
      default: {},
    },
    escalations: {
      $ref: "https://manifold.wyrd.company/schemas/escalations-configuration",
      default: {},
    },
  },
  $defs: {
    "declared-name": {
      description:
        "A name the user declares, such as a credential or environment name: a lower-case slug of at most 64 characters. A section names one with a `$ref` to `https://manifold.wyrd.company/schemas/service-configuration#/$defs/declared-name`.",
      type: "string",
      maxLength: 64,
      pattern: "^[a-z][a-z0-9]*(-[a-z0-9]+)*$",
    },
    credential: {
      description:
        "One credential, discriminated by `kind`. Each kind is an `if`/`then` entry, so that the defaults of the kind's schema apply.",
      type: "object",
      required: ["kind"],
      properties: {
        kind: {
          enum: ["github-app", "t3code-token", "ntfy-token"],
        },
      },
      allOf: [
        {
          if: {
            properties: {
              kind: {
                const: "github-app",
              },
            },
          },
          then: {
            $ref: "#/$defs/github-app-credential",
          },
        },
        {
          if: {
            properties: {
              kind: {
                const: "t3code-token",
              },
            },
          },
          then: {
            $ref: "https://manifold.wyrd.company/schemas/t3code-environments-configuration#/$defs/t3code-token-credential",
          },
        },
        {
          if: {
            properties: {
              kind: {
                const: "ntfy-token",
              },
            },
          },
          then: {
            $ref: "https://manifold.wyrd.company/schemas/escalations-configuration#/$defs/ntfy-token-credential",
          },
        },
      ],
    },
    "github-app-credential": {
      description:
        "A GitHub App installation. The service mints a short-lived installation token from it each time it authenticates.",
      type: "object",
      additionalProperties: false,
      required: ["kind", "appId", "installationId", "privateKeyFile"],
      properties: {
        kind: {
          const: "github-app",
        },
        appId: {
          description: "The GitHub App's numeric app ID.",
          type: "integer",
          minimum: 1,
        },
        installationId: {
          description:
            "The numeric ID of the App's installation on the owner of the repositories it reaches.",
          type: "integer",
          minimum: 1,
        },
        privateKeyFile: {
          description:
            "Path of the App's PEM private key file. A relative path resolves against the directory of the configuration file.",
          type: "string",
          minLength: 1,
        },
        apiUrl: {
          description: "The base URL of the GitHub REST API that mints tokens.",
          type: "string",
          pattern: "^https?://[^\\s]+$",
          default: "https://api.github.com",
        },
      },
    },
  },
} as const;
export const processRepositoryConfigurationSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://manifold.wyrd.company/schemas/process-repository-configuration",
  title: "Process repository configuration",
  description: "The value of the `processRepository` section of the service configuration.",
  type: "object",
  additionalProperties: false,
  required: ["url", "directory"],
  properties: {
    url: {
      description:
        "The smart HTTP URL of the process repository's remote, with no user information. An `http://` URL is accepted only without a credential.",
      type: "string",
      pattern: "^https?://[^\\s/?#@]+([/?#][^\\s]*)?$",
    },
    branch: {
      description: "The branch the service follows.",
      type: "string",
      minLength: 1,
      default: "main",
    },
    credential: {
      description:
        "The name of the credential, in the `credentials` section, that authenticates to the remote. Absent for a public repository.",
      $ref: "https://manifold.wyrd.company/schemas/service-configuration#/$defs/declared-name",
    },
    directory: {
      description:
        "The directory that holds the service's bare clone and its current commit. A relative path resolves against the directory of the configuration file. Created when absent.",
      type: "string",
      minLength: 1,
    },
    pullTimeoutMs: {
      description:
        "The most time in milliseconds a pull's requests to the remote may take, measured from the start of the pull.",
      type: "integer",
      minimum: 1,
      default: 60000,
    },
  },
} as const;
export const comparatorSandboxConfigurationSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://manifold.wyrd.company/schemas/comparator-sandbox-configuration",
  title: "Comparator sandbox configuration",
  description: "The value of the `comparatorSandbox` section of the service configuration.",
  type: "object",
  additionalProperties: false,
  properties: {
    timeoutMs: {
      description: "Per-evaluation timeout in milliseconds.",
      type: "integer",
      minimum: 1,
      default: 100,
    },
    memoryLimitMiB: {
      description:
        "Maximum linear memory per loaded comparator in mebibytes, including the engine's allocations. The comparator's heap cannot grow beyond this bound. The maximum lies within the 16 MiB to 2 GiB memory the QuickJS wasm binary imports.",
      type: "integer",
      minimum: 16,
      maximum: 2048,
      default: 32,
    },
  },
} as const;
export const httpHostConfigurationSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://manifold.wyrd.company/schemas/http-host-configuration",
  title: "HTTP host configuration",
  description:
    "The value of the `http` section of the service configuration: where the service's HTTP host listens.",
  type: "object",
  additionalProperties: false,
  properties: {
    host: {
      description: "The address the HTTP host binds.",
      type: "string",
      minLength: 1,
      default: "127.0.0.1",
    },
    port: {
      description: "The TCP port the HTTP host binds; 0 binds a free port.",
      type: "integer",
      minimum: 0,
      maximum: 65535,
      default: 7480,
    },
  },
} as const;
export const storeConfigurationSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://manifold.wyrd.company/schemas/store-configuration",
  title: "Store configuration",
  description: "The value of the `store` section of the service configuration.",
  type: "object",
  additionalProperties: false,
  required: ["file"],
  properties: {
    file: {
      description:
        "Path of the store's SQLite database file. A relative path resolves against the directory of the configuration file. Created, with its directory, when absent.",
      type: "string",
      minLength: 1,
    },
  },
} as const;
export const serviceConfigurationSchemas = [
  blueprintLintConfigurationSchema,
  serviceConfigurationSchema,
  processRepositoryConfigurationSchema,
  comparatorSandboxConfigurationSchema,
  httpHostConfigurationSchema,
  storeConfigurationSchema,
  expressionsConfigurationSchema,
  githubSourceConfigurationSchema,
  t3codeEnvironmentsConfigurationSchema,
  escalationsConfigurationSchema,
];
export const serviceConfigurationSchemaId = serviceConfigurationSchema.$id;
