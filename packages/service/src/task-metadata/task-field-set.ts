// ---
// relationships:
//   implements: task-metadata
// ---
import type { ManifoldIdentity, TaskMetadataDeclaration } from "@wyrd-company/manifold-shared";
import { fieldValue } from "./values.ts";
import type { Invocation } from "../actor-host/index.ts";
import type { TaskFieldWrite, GitHubWriteError } from "../github-source/index.ts";
export type TaskFieldSetErrorKind =
  | "input"
  | "identity"
  | "undeclared"
  | "value"
  | GitHubWriteError["kind"];
export type TaskFieldSetError = {
  readonly type: "task-field-set";
  readonly kind: TaskFieldSetErrorKind;
  readonly message: string;
  readonly field?: string;
};
export function taskFieldSetError(kind: TaskFieldSetErrorKind, message: string, field?: string) {
  return {
    type: "task-field-set" as const,
    kind,
    message,
    ...(field === undefined ? {} : { field }),
  };
}
export function taskFieldWrite(
  invocation: Invocation,
  identity: ManifoldIdentity,
  binding: string | undefined,
  declaration: TaskMetadataDeclaration | undefined,
  field: string,
  value: string | number | null,
): TaskFieldWrite {
  const metadata = binding === undefined ? undefined : declaration?.projects[binding];
  const declared = metadata?.fields[field];
  if (!declared || field === metadata?.lifecycle.field)
    throw taskFieldSetError(
      "undeclared",
      "Task field is not declared for the actor's Project",
      field,
    );
  const valid = fieldValue(declared, value).state !== "invalid";
  if (!valid)
    throw taskFieldSetError(
      "value",
      "Value does not match the task field's type or options",
      field,
    );
  return {
    ...invocation,
    projectNodeId: identity.project!,
    issueNodeId: identity.issue!,
    field,
    storage: declared.storage,
    labels:
      declared.storage.kind === "label" && declared.type === "single-select"
        ? declared.options.map(
            (option) =>
              `${declared.storage.kind === "label" ? declared.storage.prefix : ""}${option.name}`,
          )
        : [],
    repositories:
      declared.storage.kind === "label" || declared.storage.kind === "milestone"
        ? (metadata?.repositories ?? [])
        : [],
    value,
  };
}
