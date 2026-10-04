// ---
// relationships:
//   realizes: [blueprint, blueprint-expressions]
// ---
/* eslint-disable unicorn/no-thenable -- JSON Schema uses the then keyword. */
// Generated from the specification assets; agreement is tested.
export const blueprintSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://manifold.wyrd.company/schemas/blueprint",
  title: "Blueprint",
  description:
    "The blueprint file a process repository declares, the version identity the loader gives it, and the finding the blueprint lint reports.",
  $defs: {
    blueprint: {
      description: "One blueprint file.",
      type: "object",
      required: ["machine", "schemas"],
      additionalProperties: false,
      properties: {
        description: {
          type: "string",
        },
        machine: {
          $ref: "#/$defs/machine",
        },
        schemas: {
          $ref: "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-schemas",
        },
      },
    },
    machine: {
      description:
        "The root state node of the machine configuration, with the machine id and the initial context.",
      type: "object",
      allOf: [
        {
          $ref: "#/$defs/state-node-properties",
        },
      ],
      propertyNames: {
        enum: [
          "description",
          "type",
          "initial",
          "history",
          "target",
          "states",
          "on",
          "always",
          "after",
          "onDone",
          "entry",
          "exit",
          "invoke",
          "meta",
          "tags",
          "output",
          "id",
          "context",
        ],
      },
      properties: {
        context: {
          type: "object",
        },
      },
    },
    "state-node": {
      type: "object",
      allOf: [
        {
          $ref: "#/$defs/state-node-properties",
        },
      ],
      propertyNames: {
        enum: [
          "description",
          "type",
          "initial",
          "history",
          "target",
          "states",
          "on",
          "always",
          "after",
          "onDone",
          "entry",
          "exit",
          "invoke",
          "meta",
          "tags",
          "output",
          "id",
        ],
      },
    },
    "state-node-properties": {
      description: "The keys a state node shares with the root.",
      type: "object",
      properties: {
        id: {
          type: "string",
          minLength: 1,
        },
        description: {
          type: "string",
        },
        type: {
          enum: ["atomic", "compound", "parallel", "final", "history"],
        },
        initial: {
          $ref: "#/$defs/state-key",
        },
        history: {
          enum: ["shallow", "deep"],
        },
        target: {
          $ref: "#/$defs/targets",
        },
        states: {
          type: "object",
          propertyNames: {
            $ref: "#/$defs/state-key",
          },
          additionalProperties: {
            $ref: "#/$defs/state-node",
          },
        },
        on: {
          type: "object",
          additionalProperties: {
            $ref: "#/$defs/transitions",
          },
        },
        always: {
          $ref: "#/$defs/transitions",
        },
        after: {
          type: "object",
          propertyNames: {
            description:
              "A delay in milliseconds as decimal digits, or a delay implementation name.",
            minLength: 1,
          },
          additionalProperties: {
            $ref: "#/$defs/transitions",
          },
        },
        onDone: {
          $ref: "#/$defs/transitions",
        },
        entry: {
          $ref: "#/$defs/actions",
        },
        exit: {
          $ref: "#/$defs/actions",
        },
        invoke: {
          oneOf: [
            {
              $ref: "#/$defs/invoke",
            },
            {
              type: "array",
              items: {
                $ref: "#/$defs/invoke",
              },
            },
          ],
        },
        meta: {
          type: "object",
        },
        tags: {
          oneOf: [
            {
              type: "string",
            },
            {
              type: "array",
              items: {
                type: "string",
              },
            },
          ],
        },
        output: {
          description:
            "On a top-level final state, the machine's output: static, or an `expression.map`.",
          $ref: "#/$defs/value-or-mapping",
        },
      },
    },
    "state-key": {
      description: "A state key. Targets and state paths separate keys with `.` and ids with `#`.",
      type: "string",
      minLength: 1,
      pattern: "^[^.#]+$",
    },
    targets: {
      oneOf: [
        {
          type: "string",
          minLength: 1,
        },
        {
          type: "array",
          minItems: 1,
          items: {
            type: "string",
            minLength: 1,
          },
        },
      ],
    },
    transitions: {
      oneOf: [
        {
          $ref: "#/$defs/transition",
        },
        {
          type: "array",
          items: {
            $ref: "#/$defs/transition",
          },
        },
      ],
    },
    transition: {
      oneOf: [
        {
          type: "string",
          minLength: 1,
        },
        {
          type: "object",
          additionalProperties: false,
          properties: {
            target: {
              $ref: "#/$defs/targets",
            },
            guard: {
              $ref: "#/$defs/reference",
            },
            actions: {
              $ref: "#/$defs/actions",
            },
            reenter: {
              type: "boolean",
            },
            description: {
              type: "string",
            },
            meta: {
              type: "object",
            },
          },
        },
      ],
    },
    actions: {
      oneOf: [
        {
          $ref: "#/$defs/reference",
        },
        {
          type: "array",
          items: {
            $ref: "#/$defs/reference",
          },
        },
      ],
    },
    reference: {
      description:
        "An implementation referenced by name, with optional parameters, or an expression reference. An expression implementation is never referenced by its bare name.",
      oneOf: [
        {
          $ref: "#/$defs/implementation-name",
        },
        {
          type: "object",
          required: ["type"],
          additionalProperties: false,
          properties: {
            type: {
              $ref: "#/$defs/implementation-name",
            },
            params: {
              type: "object",
            },
          },
        },
        {
          $ref: "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference",
        },
      ],
    },
    "implementation-name": {
      description:
        "The name of an implementation that code registers. Names beginning with `expression.` belong to the expression implementations.",
      type: "string",
      minLength: 1,
      not: {
        pattern: "^expression\\.",
      },
    },
    "value-or-mapping": {
      description:
        "A static value, or a mapping. An object whose `type` is `expression.map` is a mapping and has the expression reference shape.",
      if: {
        type: "object",
        required: ["type"],
        properties: {
          type: {
            const: "expression.map",
          },
        },
      },
      then: {
        $ref: "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference",
      },
    },
    invoke: {
      type: "object",
      required: ["src"],
      additionalProperties: false,
      properties: {
        src: {
          $ref: "#/$defs/implementation-name",
        },
        id: {
          type: "string",
          minLength: 1,
        },
        systemId: {
          type: "string",
          minLength: 1,
        },
        input: {
          description: "Static input, or an `expression.map`.",
          $ref: "#/$defs/value-or-mapping",
        },
        onDone: {
          $ref: "#/$defs/transitions",
        },
        onError: {
          $ref: "#/$defs/transitions",
        },
        onSnapshot: {
          $ref: "#/$defs/transitions",
        },
      },
    },
    "blueprint-version": {
      description: "The identity the loader gives a loaded blueprint.",
      type: "object",
      required: ["commit", "path"],
      additionalProperties: false,
      properties: {
        commit: {
          description: "The full id of the process repository commit the file was read at.",
          type: "string",
          pattern: "^([0-9a-f]{40}|[0-9a-f]{64})$",
        },
        path: {
          description: "The repository-relative path of the file.",
          type: "string",
          pattern: "^blueprints/.+\\.ya?ml$",
        },
      },
    },
    "blueprint-version-key": {
      description: "A blueprint version as one string, `<commit>:<path>`.",
      type: "string",
      pattern: "^([0-9a-f]{40}|[0-9a-f]{64}):blueprints/.+\\.ya?ml$",
    },
    "blueprint-finding": {
      description: "One failure the blueprint lint reports for one file.",
      type: "object",
      required: ["path", "kind", "location", "message"],
      additionalProperties: false,
      properties: {
        path: {
          description: "The file's repository-relative path, or the file as given to the host CLI.",
          type: "string",
        },
        kind: {
          enum: [
            "yaml",
            "shape",
            "schema-invalid",
            "implementation-unknown",
            "machine",
            "final-state-missing",
            "syntax",
            "evaluation",
            "result",
            "schema",
            "schema-missing",
            "site-unsupported",
          ],
        },
        location: {
          description: "The RFC 6901 JSON Pointer of the failing value in the document.",
          type: "string",
        },
        message: {
          type: "string",
        },
        line: {
          description: "For `yaml`, the 1-based line.",
          type: "integer",
          minimum: 1,
        },
        column: {
          description: "For `yaml`, the 1-based column.",
          type: "integer",
          minimum: 1,
        },
        implementationKind: {
          description: "For `implementation-unknown`, the kind of the reference.",
          enum: ["actor", "action", "guard", "delay"],
        },
        name: {
          description: "For `implementation-unknown`, the name referenced.",
          type: "string",
        },
        expression: {
          type: "string",
        },
        code: {
          type: "string",
        },
        position: {
          type: "integer",
          minimum: 0,
        },
        schemaErrors: {
          $ref: "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/error-detail/properties/schemaErrors",
        },
        sample: {
          type: "string",
          pattern: "^(examples\\[[0-9]+\\]|full|required)$",
        },
        eventType: {
          type: "string",
        },
      },
    },
  },
};
export const blueprintExpressionsSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://manifold.wyrd.company/schemas/blueprint-expressions",
  title: "Blueprint Expressions",
  description:
    "The shapes of JSONata expressions in a blueprint: the expression reference, the expression schemas a blueprint supplies, the `expression.error` event, and the expression finding the lint reports.",
  $defs: {
    "expression-reference": {
      description:
        "A JSONata expression carried as the parameter of a generic implementation. Guards and matches stand where XState accepts a guard, assignments where it accepts an action, and mappings as the value of `input` on an invoke or `output` on a top-level final state.",
      type: "object",
      required: ["type", "params"],
      additionalProperties: false,
      properties: {
        type: {
          enum: ["expression.guard", "expression.match", "expression.assign", "expression.map"],
        },
        params: {
          type: "object",
          required: ["expression"],
          additionalProperties: false,
          properties: {
            expression: {
              description: "The JSONata source.",
              type: "string",
              minLength: 1,
            },
          },
        },
      },
    },
    "expression-schemas": {
      description:
        "The JSON Schemas that bound a blueprint's expressions. Each value is a JSON Schema of draft 2020-12.",
      type: "object",
      required: ["input", "output", "context", "events"],
      additionalProperties: false,
      properties: {
        input: {
          $ref: "#/$defs/json-schema",
        },
        output: {
          $ref: "#/$defs/json-schema",
        },
        context: {
          $ref: "#/$defs/json-schema",
        },
        events: {
          description:
            "One schema per accepted event type, keyed by type, describing the whole event object including `type`.",
          type: "object",
          additionalProperties: {
            $ref: "#/$defs/json-schema",
          },
        },
        actors: {
          description: "The input and output schema of each invoked `src`, keyed by `src`.",
          type: "object",
          additionalProperties: {
            type: "object",
            required: ["input", "output"],
            additionalProperties: false,
            properties: {
              input: {
                $ref: "#/$defs/json-schema",
              },
              output: {
                $ref: "#/$defs/json-schema",
              },
            },
          },
        },
      },
    },
    "json-schema": {
      description: "A JSON Schema of draft 2020-12.",
      type: ["object", "boolean"],
    },
    "error-detail": {
      description: "What failed, where, and why.",
      type: "object",
      required: ["kind", "location", "expression", "message"],
      additionalProperties: false,
      properties: {
        kind: {
          enum: ["syntax", "evaluation", "result", "schema"],
        },
        location: {
          description:
            "Where the expression is. For a blueprint, the RFC 6901 JSON Pointer of the expression reference in the machine configuration.",
          type: "string",
        },
        expression: {
          description: "The JSONata source.",
          type: "string",
        },
        message: {
          type: "string",
        },
        code: {
          description: "The JSONata error code, such as `S0211` or `T0410`.",
          type: "string",
        },
        position: {
          description: "The character position in the expression that JSONata reports.",
          type: "integer",
          minimum: 0,
        },
        schemaErrors: {
          description: "The validation errors of a result that failed its schema.",
          type: "array",
          items: {
            type: "object",
            required: ["instancePath", "message"],
            properties: {
              instancePath: {
                type: "string",
              },
              message: {
                type: "string",
              },
            },
          },
        },
      },
    },
    "expression-error-event": {
      description: "Raised to the actor when an `expression.assign` fails.",
      type: "object",
      required: ["type", "error"],
      additionalProperties: false,
      properties: {
        type: {
          const: "expression.error",
        },
        error: {
          $ref: "#/$defs/error-detail",
        },
      },
    },
    "expression-finding": {
      description: "One failure the expression lint reports for one site and sample.",
      type: "object",
      required: ["kind", "location", "expression", "message"],
      additionalProperties: false,
      properties: {
        kind: {
          enum: ["syntax", "evaluation", "result", "schema", "schema-missing", "site-unsupported"],
        },
        location: {
          type: "string",
        },
        expression: {
          type: "string",
        },
        message: {
          type: "string",
        },
        code: {
          type: "string",
        },
        position: {
          type: "integer",
          minimum: 0,
        },
        schemaErrors: {
          $ref: "#/$defs/error-detail/properties/schemaErrors",
        },
        sample: {
          description: "The sample that failed, as `examples[n]`, `full`, or `required`.",
          type: "string",
          pattern: "^(examples\\[[0-9]+\\]|full|required)$",
        },
        eventType: {
          description: "The event type of the sample, for a site whose input holds an event.",
          type: "string",
        },
      },
    },
  },
};
