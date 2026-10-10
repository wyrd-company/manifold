// ---
// relationships:
//   implements: escalations-configuration
// ---
export const escalationsConfigurationSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://manifold.wyrd.company/schemas/escalations-configuration",
  title: "Escalations configuration",
  description:
    "The `escalations` section of the service configuration: the public URL of the answer page, the ntfy topic behind each notification destination, and the timing of requests to ntfy.",
  type: "object",
  additionalProperties: false,
  properties: {
    publicUrl: {
      description:
        "The base URL at which a person's device reaches the service's HTTP host. Required when `destinations` is not empty.",
      type: "string",
      pattern: "^https?://[^\\s]+$",
    },
    destinations: {
      description: "Notification destinations, keyed by declared name.",
      type: "object",
      default: {},
      propertyNames: {
        $ref: "https://manifold.wyrd.company/schemas/service-configuration#/$defs/declared-name",
      },
      additionalProperties: {
        $ref: "#/$defs/destination",
      },
    },
    requestTimeoutMs: {
      description: "The most time one request to an ntfy server may take.",
      type: "integer",
      minimum: 1000,
      maximum: 300000,
      default: 30000,
    },
    retryIntervalMs: {
      description: "The wait before a publish that failed transiently is tried again.",
      type: "integer",
      minimum: 1000,
      maximum: 3600000,
      default: 60000,
    },
  },
  $defs: {
    destination: {
      type: "object",
      additionalProperties: false,
      required: ["topic", "posture"],
      properties: {
        server: {
          description: "The base URL of the ntfy server.",
          type: "string",
          pattern: "^https?://[^\\s]+$",
          default: "https://ntfy.sh",
        },
        topic: {
          type: "string",
          pattern: "^[A-Za-z0-9_-]{1,64}$",
        },
        posture: {
          enum: ["open", "reserved", "self-hosted"],
        },
        credential: {
          $ref: "https://manifold.wyrd.company/schemas/service-configuration#/$defs/declared-name",
        },
        priority: {
          type: "integer",
          minimum: 1,
          maximum: 5,
          default: 4,
        },
      },
    },
    "ntfy-token-credential": {
      description:
        "An ntfy access token that may publish to a destination's topic, read from a file at each request.",
      type: "object",
      additionalProperties: false,
      required: ["kind", "tokenFile"],
      properties: {
        kind: {
          const: "ntfy-token",
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
