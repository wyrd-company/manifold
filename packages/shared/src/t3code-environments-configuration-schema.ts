// ---
// relationships:
//   realizes: t3code-environments-configuration
// ---
// Generated from the specification asset; agreement is tested.
export const t3codeEnvironmentsConfigurationSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://manifold.wyrd.company/schemas/t3code-environments-configuration",
  title: "T3 Code environments configuration",
  description:
    "The value of the `environments` section of the service configuration: the T3 Code environments Manifold connects to, keyed by environment name.",
  type: "object",
  propertyNames: {
    $ref: "https://manifold.wyrd.company/schemas/service-configuration#/$defs/declared-name",
  },
  additionalProperties: {
    $ref: "#/$defs/environment",
  },
  $defs: {
    environment: {
      type: "object",
      additionalProperties: false,
      required: ["url", "credential"],
      properties: {
        url: {
          description: "The T3 Code server's base URL.",
          type: "string",
          pattern: "^https?://[^\\s]+$",
        },
        credential: {
          description: "The name of a `t3code-token` credential.",
          $ref: "https://manifold.wyrd.company/schemas/service-configuration#/$defs/declared-name",
        },
        reconnect: {
          $ref: "#/$defs/reconnect",
          default: {},
        },
        heartbeat: {
          $ref: "#/$defs/heartbeat",
          default: {},
        },
        openTimeoutMs: {
          description: "How long a connection attempt may take to open, in milliseconds.",
          type: "integer",
          minimum: 1,
          default: 10000,
        },
      },
    },
    reconnect: {
      description:
        "Backoff between connection attempts: `initialMs` multiplied by `factor` per retry, at most `maxMs`, spread by `jitter`. The loader also checks that `maxMs` is at least `initialMs`.",
      type: "object",
      additionalProperties: false,
      properties: {
        initialMs: {
          type: "integer",
          minimum: 1,
          default: 1000,
        },
        factor: {
          type: "number",
          minimum: 1,
          default: 2,
        },
        maxMs: {
          type: "integer",
          minimum: 1,
          default: 30000,
        },
        jitter: {
          type: "number",
          minimum: 0,
          maximum: 1,
          default: 0.2,
        },
      },
    },
    heartbeat: {
      description: "Socket keepalive.",
      type: "object",
      additionalProperties: false,
      properties: {
        intervalMs: {
          description: "Milliseconds between pings.",
          type: "integer",
          minimum: 1,
          default: 5000,
        },
        missedPongLimit: {
          description:
            "Unanswered pings in a row after which the socket is dropped and reconnected.",
          type: "integer",
          minimum: 1,
          default: 3,
        },
      },
    },
    "t3code-token-credential": {
      description:
        "A bearer access token for a T3 Code server, read from a file at each connection attempt.",
      type: "object",
      additionalProperties: false,
      required: ["kind", "tokenFile"],
      properties: {
        kind: {
          const: "t3code-token",
        },
        tokenFile: {
          description:
            "Path of the file holding the token. A relative path resolves against the directory of the configuration file.",
          type: "string",
          minLength: 1,
        },
      },
    },
  },
} as const;
