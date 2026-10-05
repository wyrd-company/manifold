// ---
// relationships:
//   realizes: [agent-threads, escalation-contract]
// ---
// Generated from specification schema assets.
export const implementationContracts = {
  "thread-create": {
    input: {
      type: "object",
      required: ["project", "title", "model"],
      properties: {
        project: {
          description: "A string that is not empty after trimming.",
          type: "string",
          pattern: "\\S",
        },
        title: {
          description: "A string that is not empty after trimming.",
          type: "string",
          pattern: "\\S",
        },
        values: {
          description: "The object the templates render against.",
          type: "object",
          default: {},
        },
        model: {
          type: "object",
          required: ["instanceId", "model"],
          properties: {
            instanceId: {
              description:
                "A provider instance id: letters, digits, `-`, and `_`, starting with a letter, at most 64 characters, with optional surrounding whitespace.",
              type: "string",
              pattern: "^\\s*[a-zA-Z][a-zA-Z0-9_-]{0,63}\\s*$",
            },
            model: {
              description: "A string that is not empty after trimming.",
              type: "string",
              pattern: "\\S",
            },
            options: {
              description: "Option id to value.",
              type: "object",
              propertyNames: {
                pattern: "\\S",
              },
              additionalProperties: {
                oneOf: [
                  {
                    description: "A string that is not empty after trimming.",
                    type: "string",
                    pattern: "\\S",
                  },
                  {
                    type: "boolean",
                  },
                ],
              },
            },
          },
          additionalProperties: false,
        },
        runtimeMode: {
          enum: ["approval-required", "auto-accept-edits", "auto", "full-access"],
        },
        interactionMode: {
          enum: ["default", "plan"],
        },
        branch: {
          oneOf: [
            {
              description: "A string that is not empty after trimming.",
              type: "string",
              pattern: "\\S",
            },
            {
              type: "null",
            },
          ],
          default: null,
        },
        worktreePath: {
          oneOf: [
            {
              description: "A string that is not empty after trimming.",
              type: "string",
              pattern: "\\S",
            },
            {
              type: "null",
            },
          ],
          default: null,
        },
      },
      additionalProperties: false,
    },
    output: {
      type: "object",
      required: ["threadId"],
      properties: {
        threadId: {
          description: "A string that is not empty after trimming.",
          type: "string",
          pattern: "\\S",
        },
      },
      additionalProperties: false,
    },
  },
  "turn-prepare": {
    output: {
      type: "object",
      required: ["messageId"],
      properties: {
        messageId: {
          description: "A string that is not empty after trimming.",
          type: "string",
          pattern: "\\S",
        },
      },
      additionalProperties: false,
    },
  },
  "turn-start": {
    input: {
      type: "object",
      required: ["threadId", "messageId", "prompt"],
      properties: {
        threadId: {
          description: "A string that is not empty after trimming.",
          type: "string",
          pattern: "\\S",
        },
        messageId: {
          description: "A string that is not empty after trimming.",
          type: "string",
          pattern: "\\S",
        },
        prompt: {
          description: "A repository-relative path with `/` separators.",
          type: "string",
          pattern: "^(?!/)(?!.*(^|/)\\.{1,2}(/|$))(?!.*//)[^\\\\]+$",
        },
        values: {
          description: "The object the templates render against.",
          type: "object",
          default: {},
        },
        model: {
          type: "object",
          required: ["instanceId", "model"],
          properties: {
            instanceId: {
              description:
                "A provider instance id: letters, digits, `-`, and `_`, starting with a letter, at most 64 characters, with optional surrounding whitespace.",
              type: "string",
              pattern: "^\\s*[a-zA-Z][a-zA-Z0-9_-]{0,63}\\s*$",
            },
            model: {
              description: "A string that is not empty after trimming.",
              type: "string",
              pattern: "\\S",
            },
            options: {
              description: "Option id to value.",
              type: "object",
              propertyNames: {
                pattern: "\\S",
              },
              additionalProperties: {
                oneOf: [
                  {
                    description: "A string that is not empty after trimming.",
                    type: "string",
                    pattern: "\\S",
                  },
                  {
                    type: "boolean",
                  },
                ],
              },
            },
          },
          additionalProperties: false,
        },
        runtimeMode: {
          enum: ["approval-required", "auto-accept-edits", "auto", "full-access"],
        },
        interactionMode: {
          enum: ["default", "plan"],
        },
      },
      additionalProperties: false,
    },
    output: {
      type: "object",
      required: ["threadId", "messageId"],
      properties: {
        threadId: {
          description: "A string that is not empty after trimming.",
          type: "string",
          pattern: "\\S",
        },
        messageId: {
          description: "A string that is not empty after trimming.",
          type: "string",
          pattern: "\\S",
        },
      },
      additionalProperties: false,
    },
  },
  escalate: {
    input: {
      description:
        "The input of the `escalate` actor implementation. Choice ids are unique within one input, a rule the implementation checks.",
      type: "object",
      additionalProperties: false,
      required: ["question"],
      properties: {
        question: {
          type: "string",
          minLength: 1,
          maxLength: 8000,
        },
        title: {
          type: "string",
          minLength: 1,
          maxLength: 120,
          default: "Question",
        },
        choices: {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "label"],
            properties: {
              id: {
                type: "string",
                maxLength: 32,
                pattern: "^[a-z][a-z0-9]*(-[a-z0-9]+)*$",
              },
              label: {
                type: "string",
                minLength: 1,
                maxLength: 40,
              },
            },
          },
        },
        freeText: {
          type: "boolean",
          default: false,
        },
        destinations: {
          type: "array",
          uniqueItems: true,
          items: {
            $ref: "https://manifold.wyrd.company/schemas/service-configuration#/$defs/declared-name",
          },
          default: ["default"],
        },
      },
      anyOf: [
        {
          required: ["choices"],
          properties: {
            choices: {
              type: "array",
              minItems: 1,
            },
          },
        },
        {
          required: ["freeText"],
          properties: {
            freeText: {
              type: "boolean",
              const: true,
            },
          },
        },
      ],
    },
    output: true,
  },
};
