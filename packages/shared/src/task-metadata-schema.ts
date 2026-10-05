// ---
// relationships:
//   realizes: task-metadata-declaration
// ---
// Generated from the specification asset; agreement is tested.
export const taskMetadataDeclarationSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://manifold.wyrd.company/schemas/task-metadata-declaration",
  title: "Task metadata declaration",
  description:
    "The document in `task-metadata.yml` at the root of the process repository, the task metadata schema, and the finding its lint reports. An empty document declares no lifecycle field.",
  $defs: {
    declaration: {
      description: "The task metadata declaration.",
      type: "object",
      additionalProperties: false,
      properties: {
        projects: {
          description:
            "The metadata of each bound GitHub Project's tasks, keyed by GitHub Project binding name, a declared name.",
          type: "object",
          propertyNames: {
            $ref: "https://manifold.wyrd.company/schemas/service-configuration#/$defs/declared-name",
          },
          additionalProperties: {
            $ref: "#/$defs/project",
          },
        },
      },
    },
    project: {
      description: "The metadata of one bound GitHub Project's tasks.",
      type: "object",
      additionalProperties: false,
      required: ["lifecycle"],
      properties: {
        lifecycle: {
          $ref: "#/$defs/lifecycle-field",
        },
      },
    },
    "lifecycle-field": {
      description:
        "The Project's lifecycle field: the single-select field a card move sets, and the option names a blueprint may set.",
      type: "object",
      additionalProperties: false,
      required: ["field", "options"],
      properties: {
        field: {
          description: "The name of a single-select field of the Project.",
          $ref: "#/$defs/name",
        },
        options: {
          description: "The names of the field's options a blueprint may set.",
          type: "array",
          minItems: 1,
          uniqueItems: true,
          items: {
            $ref: "#/$defs/name",
          },
        },
      },
    },
    name: {
      description:
        "A field or option name as GitHub shows it: not empty, with no leading or trailing white space.",
      type: "string",
      pattern: "^\\S(?:.*\\S)?$",
    },
    finding: {
      description: "One problem the task metadata lint reports.",
      type: "object",
      required: ["kind", "location", "message"],
      additionalProperties: false,
      properties: {
        kind: {
          enum: ["syntax", "schema", "unknown-binding"],
        },
        location: {
          description: "The RFC 6901 JSON Pointer of the failing value in the document.",
          type: "string",
        },
        message: {
          type: "string",
        },
      },
    },
  },
};
