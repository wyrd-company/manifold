// ---
// relationships:
//   realizes: github-source-configuration
// ---
// Generated from docs/specifications/github-source-configuration.schema.yml; agreement is tested.
export const githubSourceConfigurationSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://manifold.wyrd.company/schemas/github-source-configuration",
  title: "GitHub source configuration",
  description: "The value of the `github` section of the service configuration.",
  type: "object",
  additionalProperties: false,
  properties: {
    apiUrl: {
      description: "The base URL of the GitHub REST API.",
      type: "string",
      pattern: "^https?://[^\\s]+$",
      default: "https://api.github.com",
    },
    owners: {
      description: "The accounts Manifold reads, keyed by login.",
      type: "object",
      default: {},
      propertyNames: {
        type: "string",
        pattern: "^[A-Za-z0-9][A-Za-z0-9-]{0,38}$",
      },
      additionalProperties: {
        $ref: "#/$defs/owner",
      },
    },
    sweepIntervalMs: {
      description: "Milliseconds from the end of one sweep to the start of the next.",
      type: "integer",
      minimum: 1,
      default: 900000,
    },
    redeliveryIntervalMs: {
      description: "Milliseconds from the end of one redelivery scan to the start of the next.",
      type: "integer",
      minimum: 1,
      default: 60000,
    },
    requestTimeoutMs: {
      description: "The most milliseconds one GitHub API request may take.",
      type: "integer",
      minimum: 1,
      default: 30000,
    },
  },
  $defs: {
    owner: {
      type: "object",
      additionalProperties: false,
      required: ["credential"],
      properties: {
        credential: {
          description: "The `github-app` credential whose installation is on this account.",
          $ref: "https://manifold.wyrd.company/schemas/service-configuration#/$defs/declared-name",
        },
        hooks: {
          type: "array",
          default: [],
          items: {
            $ref: "#/$defs/hook",
          },
        },
      },
    },
    hook: {
      type: "object",
      additionalProperties: false,
      required: ["id", "secretFile"],
      properties: {
        id: {
          description: "The hook's numeric id.",
          type: "integer",
          minimum: 1,
        },
        repository: {
          description: "The repository name of a repository hook; absent for an organization hook.",
          type: "string",
          pattern: "^[A-Za-z0-9._-]{1,100}$",
        },
        secretFile: {
          description:
            "Path of the file holding the hook's secret. A relative path resolves against the directory of the configuration file.",
          type: "string",
          minLength: 1,
        },
      },
    },
  },
} as const;
