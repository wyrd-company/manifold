// ---
// relationships:
//   implements: task-metadata
// ---
import { fromPromise } from "xstate";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  blueprintSchema,
  taskMetadataDeclarationSchema,
  serviceConfigurationSchemas,
} from "@wyrd-company/manifold-shared";
import type { TaskMetadataDeclaration } from "@wyrd-company/manifold-shared";
import type { ImplementationRegistry } from "../blueprint-loader/index.ts";
import { GitHubWriteError } from "../github-source/index.ts";
import type { TaskMetadataOptions } from "./types.ts";
import { taskFieldWrite, taskFieldSetError } from "./task-field-set.ts";
import { cardMove, cardMoveError } from "./card-move.ts";
const ajv = new Ajv2020({ strict: false });
for (const schema of serviceConfigurationSchemas) ajv.addSchema(schema);
ajv.addSchema(taskMetadataDeclarationSchema);
ajv.addSchema(blueprintSchema);
const validate = ajv.compile<{ status: string }>({
  $ref: `${blueprintSchema.$id}#/$defs/card-move-input`,
});
const validateTaskField = ajv.compile<{ field: string; value: string | number | null }>({
  $ref: `${blueprintSchema.$id}#/$defs/task-field-set-input`,
});
export function metadataImplementations(
  options: TaskMetadataOptions,
  current: () => TaskMetadataDeclaration | undefined,
): ImplementationRegistry {
  return {
    actorKinds: { "github-card-move": "promise", "github-task-field-set": "promise" },
    actions: {},
    guards: {},
    delays: {},
    actors: {
      "github-task-field-set": fromPromise(async (args) => {
        const { input, signal } = args;
        const field =
          typeof input === "object" &&
          input !== null &&
          "field" in input &&
          typeof input.field === "string"
            ? input.field
            : undefined;
        if (!validateTaskField(input))
          throw taskFieldSetError("input", "Invalid task field input", field);
        const invocation = options.invocationOf(args);
        const identity = options.actorOf(invocation.actorId)?.manifold;
        if (!identity?.project || !identity.issue)
          throw taskFieldSetError("identity", "Actor has no Project or issue", field);
        const source = await options.source(signal);
        signal.throwIfAborted();
        const project = source.project(identity.project);
        const write = taskFieldWrite(
          invocation,
          identity,
          project && options.bindingOf(project),
          current(),
          input.field,
          input.value,
        );
        try {
          if (!source.writeTaskField)
            throw taskFieldSetError("rejected", "Task field writes are unavailable", field);
          await source.writeTaskField(write, signal);
        } catch (error) {
          if (error instanceof GitHubWriteError)
            throw taskFieldSetError(error.kind, error.message, field);
          throw error;
        }
        return {};
      }),
      "github-card-move": fromPromise(async (args) => {
        const { input, signal } = args;
        const status =
          typeof input === "object" &&
          input !== null &&
          "status" in input &&
          typeof input.status === "string"
            ? input.status
            : undefined;
        if (!validate(input)) throw cardMoveError("input", "Invalid card move input", status);
        const invocation = options.invocationOf(args);
        const identity = options.actorOf(invocation.actorId)?.manifold;
        if (!identity?.project || !identity.issue)
          throw cardMoveError("identity", "Actor has no Project or issue", status);
        const source = await options.source(signal);
        signal.throwIfAborted();
        const project = source.project(identity.project);
        const move = cardMove(
          invocation,
          identity,
          project && options.bindingOf(project),
          current(),
          input.status,
        );
        try {
          await source.moveCard(move, signal);
        } catch (error) {
          if (error instanceof GitHubWriteError)
            throw cardMoveError(
              error.kind === "field-missing" ||
                error.kind === "option-missing" ||
                error.kind === "item-missing" ||
                error.kind === "forbidden" ||
                error.kind === "transport" ||
                error.kind === "rejected"
                ? error.kind
                : "rejected",
              error.message,
              status,
            );
          throw error;
        }
        return {};
      }),
    },
  };
}
