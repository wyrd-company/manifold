// ---
// relationships:
//   realizes: [agent-threads, escalation-contract, agent-tools, blueprint]
// ---
// Generated from specification schema assets.
export const implementationContracts = {
  "github-card-move": {
    input: {
      description: "The input of `github-card-move`.",
      type: "object",
      required: ["status"],
      additionalProperties: false,
      properties: {
        status: {
          description:
            "A field or option name as GitHub shows it: not empty, with no leading or trailing white space.",
          type: "string",
          pattern: "^\\S(?:.*\\S)?$",
        },
      },
    },
    output: {
      description: "The output of `github-card-move`, once GitHub holds the option.",
      type: "object",
      additionalProperties: false,
      maxProperties: 0,
    },
  },
  "send-message": {
    input: {
      description: "The input of the `send-message` actor.",
      type: "object",
      additionalProperties: false,
      required: ["to", "text"],
      properties: {
        to: {
          oneOf: [
            {
              description: "A task, by its issue node id.",
              type: "object",
              additionalProperties: false,
              required: ["issue"],
              properties: {
                issue: {
                  type: "string",
                  minLength: 1,
                },
              },
            },
            {
              description: "One thread on a declared environment.",
              type: "object",
              additionalProperties: false,
              required: ["environment", "threadId"],
              properties: {
                environment: {
                  description:
                    "A name the user declares, such as a credential or environment name: a lower-case slug of at most 64 characters. A section names one with a `$ref` to `https://manifold.wyrd.company/schemas/service-configuration#/$defs/declared-name`.",
                  type: "string",
                  maxLength: 64,
                  pattern: "^[a-z][a-z0-9]*(-[a-z0-9]+)*$",
                },
                threadId: {
                  type: "string",
                  minLength: 1,
                },
              },
            },
          ],
        },
        text: {
          description: "Markdown.",
          type: "string",
          minLength: 1,
          maxLength: 8000,
        },
      },
    },
    output: {
      type: "object",
      additionalProperties: false,
      required: ["messages"],
      properties: {
        messages: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["messageId", "environment", "threadId"],
            properties: {
              messageId: {
                description:
                  "A UUID derived as `agent-tools/message` from the sending invocation and the thread.",
                type: "string",
                pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
              },
              environment: {
                type: "string",
              },
              threadId: {
                type: "string",
              },
            },
          },
        },
      },
    },
  },
  "t3code-project-create": {
    input: {
      type: "object",
      required: ["title", "workspaceRoot"],
      properties: {
        environment: {
          description: "A string that is not empty after trimming.",
          type: "string",
          pattern: "\\S",
        },
        title: {
          description: "A string that is not empty after trimming.",
          type: "string",
          pattern: "\\S",
        },
        workspaceRoot: {
          description: "A string that is not empty after trimming.",
          type: "string",
          pattern: "\\S",
        },
        values: {
          description: "The object the templates render against.",
          type: "object",
          default: {},
        },
        createWorkspaceRoot: {
          description: "Whether the server makes a workspace root that does not exist.",
          type: "boolean",
          default: false,
        },
      },
      additionalProperties: false,
    },
    output: {
      type: "object",
      required: ["projectId"],
      properties: {
        projectId: {
          description: "A string that is not empty after trimming.",
          type: "string",
          pattern: "\\S",
        },
      },
      additionalProperties: false,
    },
  },
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
            description:
              "A name the user declares, such as a credential or environment name: a lower-case slug of at most 64 characters. A section names one with a `$ref` to `https://manifold.wyrd.company/schemas/service-configuration#/$defs/declared-name`.",
            type: "string",
            maxLength: 64,
            pattern: "^[a-z][a-z0-9]*(-[a-z0-9]+)*$",
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
